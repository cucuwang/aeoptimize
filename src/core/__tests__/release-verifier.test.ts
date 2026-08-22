import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, '../../..');
const verifier = join(repositoryRoot, 'scripts/verify-release-v0.6.sh');
const expectedCommit = '0123456789abcdef0123456789abcdef01234567';
const tarballContent = 'verified aeoptimize v0.6.0 candidate';
const expectedTarballHash = createHash('sha256').update(tarballContent).digest('hex');

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runVerifier(mockBin: string, packageHash: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [verifier, expectedCommit, packageHash], {
      env: {
        ...process.env,
        PATH: `${mockBin}:${process.env.PATH}`,
        MOCK_GIT_HEAD: expectedCommit,
        MOCK_TARBALL_CONTENT: tarballContent,
      },
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function writeExecutable(path: string, contents: string): Promise<void> {
  await writeFile(path, contents, 'utf8');
  await chmod(path, 0o755);
}

describe('v0.6 public release verifier', () => {
  let testRoot: string;
  let mockBin: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'aeoptimize-release-verifier-test-'));
    mockBin = join(testRoot, 'bin');
    await mkdir(mockBin);

    await writeExecutable(join(mockBin, 'curl'), `#!/usr/bin/env bash
set -euo pipefail
output_file=
url=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output_file=$2; shift 2 ;;
    -w) shift 2 ;;
    -*) shift ;;
    *) url=$1; shift ;;
  esac
done

case "$url" in
  https://registry.npmjs.org/aeoptimize)
    printf '{"dist-tags":{"latest":"0.6.0"},"versions":{"0.6.0":{"gitHead":"%s","repository":{"url":"git+https://github.com/cucuwang/aeoptimize.git"},"homepage":"https://github.com/cucuwang/aeoptimize","bugs":{"url":"https://github.com/cucuwang/aeoptimize/issues"},"dist":{"tarball":"https://registry.npmjs.org/aeoptimize/-/aeoptimize-0.6.0.tgz"}}}}' "$MOCK_GIT_HEAD"
    ;;
  https://registry.npmjs.org/aeoptimize/-/aeoptimize-0.6.0.tgz)
    printf '%s' "$MOCK_TARBALL_CONTENT" > "$output_file"
    ;;
  https://api.github.com/repos/cucuwang/aeoptimize/releases/tags/v0.6.0)
    printf '{"tag_name":"v0.6.0","draft":false,"prerelease":false}' > "$output_file"
    printf '200'
    ;;
  *)
    printf 'unexpected curl URL: %s\n' "$url" >&2
    exit 22
    ;;
esac
`);

    await writeExecutable(join(mockBin, 'git'), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\trefs/tags/v0.6.0\n' "$MOCK_GIT_HEAD"
`);

    await writeExecutable(join(mockBin, 'npm'), `#!/usr/bin/env bash
set -euo pipefail
prefix=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix) prefix=$2; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$prefix/node_modules/.bin"
for binary in aeoptimize aeo aeo-cli; do
  printf '#!/usr/bin/env bash\nprintf "0.6.0\\n"\n' > "$prefix/node_modules/.bin/$binary"
  chmod +x "$prefix/node_modules/.bin/$binary"
done
`);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('passes only when npm metadata, tarball, aliases, tag, and Release match', async () => {
    const result = await runVerifier(mockBin, expectedTarballHash);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('PASS: npm gitHead matches');
    expect(result.stdout).toContain('PASS: npm tarball SHA-256 matches the verified candidate');
    expect(result.stdout).toContain('All public release checks passed.');
  });

  it('fails closed when npm serves a different tarball', async () => {
    const differentHash = createHash('sha256').update('different candidate').digest('hex');
    const result = await runVerifier(mockBin, differentHash);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('FAIL: npm tarball SHA-256 is');
    expect(result.stdout).not.toContain('All public release checks passed.');
  });
});
