#!/usr/bin/env bash
set -u

PACKAGE_NAME=aeoptimize
EXPECTED_VERSION=0.6.0
EXPECTED_TAG=v0.6.0
REPOSITORY=cucuwang/aeoptimize
EXPECTED_COMMIT=${1:-}

if [ -z "$EXPECTED_COMMIT" ]; then
  echo "usage: $0 <expected-release-commit>" >&2
  exit 2
fi

for command_name in awk curl jq npm git mktemp; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "missing required command: $command_name" >&2
    exit 2
  fi
done

VERIFY_BASE=${TMPDIR:-/tmp}
VERIFY_BASE=${VERIFY_BASE%/}
VERIFY_ROOT=$(mktemp -d "$VERIFY_BASE/aeoptimize-release-verify.XXXXXX")
REGISTRY_JSON="$VERIFY_ROOT/registry.json"
RELEASE_JSON="$VERIFY_ROOT/release.json"
CONSUMER_ROOT="$VERIFY_ROOT/consumer"
FAILURES=0

cleanup() {
  if [ "${KEEP_VERIFY_ROOT:-0}" = "1" ]; then
    echo "Verification workspace preserved: $VERIFY_ROOT"
    return
  fi

  case "$VERIFY_ROOT" in
    "$VERIFY_BASE"/aeoptimize-release-verify.*)
      rm -rf -- "$VERIFY_ROOT"
      ;;
    *)
      echo "Refusing to remove unexpected verification path: $VERIFY_ROOT" >&2
      ;;
  esac
}

trap cleanup EXIT

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

if curl -fsS "https://registry.npmjs.org/$PACKAGE_NAME" > "$REGISTRY_JSON"; then
  latest=$(jq -r '."dist-tags".latest // empty' "$REGISTRY_JSON")
  if [ "$latest" = "$EXPECTED_VERSION" ]; then
    pass "npm latest is $EXPECTED_VERSION"
  else
    fail "npm latest is ${latest:-missing}; expected $EXPECTED_VERSION"
  fi

  if jq -e --arg version "$EXPECTED_VERSION" '.versions[$version] != null' "$REGISTRY_JSON" >/dev/null; then
    pass "npm contains exact version $EXPECTED_VERSION"

    if npm --cache "$VERIFY_ROOT/npm-cache" install \
      --ignore-scripts --no-audit --no-fund \
      --prefix "$CONSUMER_ROOT" "$PACKAGE_NAME@$EXPECTED_VERSION" >/dev/null; then
      for binary in aeoptimize aeo aeo-cli; do
        binary_version=$("$CONSUMER_ROOT/node_modules/.bin/$binary" --version 2>/dev/null || true)
        if [ "$binary_version" = "$EXPECTED_VERSION" ]; then
          pass "$binary resolves to $EXPECTED_VERSION from the public package"
        else
          fail "$binary returned ${binary_version:-no version}; expected $EXPECTED_VERSION"
        fi
      done
    else
      fail "clean consumer installation failed for $PACKAGE_NAME@$EXPECTED_VERSION"
    fi
  else
    fail "npm does not contain exact version $EXPECTED_VERSION"
  fi
else
  fail "npm registry metadata could not be fetched"
fi

tag_lines=$(git ls-remote --tags "https://github.com/$REPOSITORY.git" \
  "refs/tags/$EXPECTED_TAG" "refs/tags/$EXPECTED_TAG^{}" 2>/dev/null || true)
tag_commit=$(printf '%s\n' "$tag_lines" | awk -v peeled="refs/tags/$EXPECTED_TAG^{}" '$2 == peeled { print $1 }')
if [ -z "$tag_commit" ]; then
  tag_commit=$(printf '%s\n' "$tag_lines" | awk -v direct="refs/tags/$EXPECTED_TAG" '$2 == direct { print $1 }')
fi

if [ "$tag_commit" = "$EXPECTED_COMMIT" ]; then
  pass "$EXPECTED_TAG points to $EXPECTED_COMMIT"
else
  fail "$EXPECTED_TAG points to ${tag_commit:-missing}; expected $EXPECTED_COMMIT"
fi

release_status=$(curl -sS -o "$RELEASE_JSON" -w '%{http_code}' \
  "https://api.github.com/repos/$REPOSITORY/releases/tags/$EXPECTED_TAG" || true)
if [ "$release_status" = "200" ]; then
  release_state=$(jq -r '[.tag_name, (.draft | tostring), (.prerelease | tostring)] | @tsv' "$RELEASE_JSON")
  if [ "$release_state" = "$EXPECTED_TAG"$'\tfalse\tfalse' ]; then
    pass "GitHub Release is published for $EXPECTED_TAG"
  else
    fail "GitHub Release is not a published non-prerelease for $EXPECTED_TAG"
  fi
else
  fail "GitHub Release lookup returned HTTP ${release_status:-error}"
fi

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES release verification check(s) failed." >&2
  exit 1
fi

echo "All public release checks passed."
