# v0.6 release and rollback guide

Version 0.6.0 establishes the evidence-bounded scoring, packaging, and GitHub Action contracts. It is not released until npm, the Git tag, and the GitHub Release are each created and read back independently.

## Release acceptance

Before publication, run `npm ci` and `npm run release:check` from the intended release commit. The candidate gate verifies all of the following:

1. `npm run check`, `npm audit --audit-level=high`, and `bash action/test-contract.sh` pass.
2. The public v0.6 rule corpus covers the positive, negative, and false-positive boundary for every scored rule.
3. An actual `npm pack` candidate contains the required public files, its SHA-256 is recorded, and a clean consumer can invoke `aeoptimize`, `aeo`, and `aeo-cli` from that exact tarball.
4. CI succeeds on Node.js 22 and 24 for the release commit.
5. The JSON automation contract and Action sample tests pass.
6. The npm account is verified immediately before publishing.

CI runs the same candidate gate on Node.js 22 and 24 and compares version, filename, SHA-256, file count, and unpacked size. `prepublishOnly` invokes the candidate gate again and refuses a dirty worktree by default.

Publishing, tagging, creating a GitHub Release, changing npm dist-tags, and deprecating a version are separate external mutations and require separate maintainer authorization.

## Release notes

### Evidence-bounded readiness scoring

- Reframe the score as deterministic content readiness rather than a prediction of ranking or AI citation.
- Treat FAQ structure and `llms.txt` as optional, zero-point signals.
- Remove exact-one-H1 and fixed meta-description-length assumptions.
- Flag unsourced quantitative claims instead of rewarding more numbers.
- Publish a versioned fixture corpus with positive, negative, and false-positive boundaries for every scored rule.

### Reproducible automation

- Support maintained Node.js 22 and 24 lines.
- Keep `aeoptimize`, `aeo`, and `aeo-cli` in the packed npm manifest.
- Add an advisory-by-default GitHub Action with explicit blocking mode and stable JSON outputs.
- Add a copyable end-to-end Action sample and release-time contract checks.
- Refresh dependencies and require zero high or critical audit findings at release time.

No ranking, traffic, indexing, rich-result, AI Overview, or citation outcome is claimed by this release.

## Publication readback

After an authorized npm publication:

```bash
npm view aeoptimize version dist-tags --json
npm view aeoptimize@0.6.0 version gitHead repository homepage bugs dist --json
consumer_root=$(mktemp -d "${TMPDIR:-/tmp}/aeoptimize-v0.6-consumer.XXXXXX")
npm install --prefix "$consumer_root" aeoptimize@0.6.0
"$consumer_root/node_modules/.bin/aeoptimize" --version
"$consumer_root/node_modules/.bin/aeo" --version
"$consumer_root/node_modules/.bin/aeo-cli" --version
rm -rf -- "$consumer_root"
```

After separately authorized tag and GitHub Release creation, verify that `v0.6.0` points to the tested release commit and that the Release is published rather than draft or prerelease.

The fail-closed public verifier checks npm `latest`, the exact version, public repository identity, the downloaded tarball SHA-256, all three installed CLI aliases, the tag target, and the published GitHub Release. The tarball hash is the required artifact-identity gate. If npm exposes `gitHead`, it must match the expected release commit; absence is reported as informational because npm's publish contract guarantees tarball integrity but does not guarantee that metadata field.

```bash
bash scripts/verify-release-v0.6.sh <verified-release-commit> <verified-package-sha256>
```

## Rollback

An npm dist-tag rollback changes what `npm install aeoptimize` selects; it does not remove exact-version installs. Never silently move an existing Git tag to different code.

If npm 0.6.0 is unsuitable before a corrective release is available, request separate authorization for each mutation, then:

```bash
npm dist-tag add aeoptimize@0.5.3 latest
npm deprecate aeoptimize@0.6.0 "Use 0.5.3 until the corrective release is available."
```

Mark the GitHub Release with the same warning. Preserve the `v0.6.0` tag as evidence of what was published, fix forward in 0.6.1, rerun the complete release acceptance suite, and only then move npm `latest` to the corrective version.
