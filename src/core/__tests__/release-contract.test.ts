import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleFixtureCorpus, ruleFixtureCorpusVersion, type RuleFixtureKind } from '../../../fixtures/v0.6/rule-corpus.js';
import { allRules } from '../rules.js';
import { scan } from '../scanner.js';
import type { ParsedDocument } from '../types.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, '../../..');
const fixtureKinds: RuleFixtureKind[] = ['positive', 'negative', 'boundary'];

function makeDocument(overrides: Partial<ParsedDocument>): ParsedDocument {
  return {
    url: 'fixture://v0.6-rule-corpus',
    title: 'v0.6 rule fixture',
    headings: [],
    paragraphs: [],
    jsonLd: [],
    metaTags: {},
    links: [],
    rawText: '',
    ...overrides,
  };
}

describe('v0.6 public rule fixture corpus', () => {
  const scoredRules = allRules.filter((rule) => rule.weight > 0);

  it('covers every scored rule and only scored rules', () => {
    expect(Object.keys(ruleFixtureCorpus).sort()).toEqual(scoredRules.map((rule) => rule.id).sort());
  });

  for (const rule of scoredRules) {
    describe(rule.id, () => {
      for (const kind of fixtureKinds) {
        it(`${kind} fixture matches the versioned expectation`, () => {
          const fixture = ruleFixtureCorpus[rule.id][kind];
          const result = rule.evaluate(makeDocument(fixture.document));

          expect(fixture.purpose.length).toBeGreaterThan(20);
          expect(result.maxScore).toBe(rule.weight);
          expect(result.score).toBe(fixture.expected.score);
          expect(result.issues).toHaveLength(fixture.expected.issues);
          expect(result.suggestions).toHaveLength(fixture.expected.suggestions);
        });
      }
    });
  }

  it('keeps the corpus, package, methodology, and Action sample on the same release version', async () => {
    const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'));
    const methodology = await readFile(join(repositoryRoot, 'docs/methodology.md'), 'utf8');
    const sampleWorkflow = await readFile(
      join(repositoryRoot, 'examples/github-action-sample/.github/workflows/aeoptimize.yml'),
      'utf8',
    );

    expect(ruleFixtureCorpusVersion).toBe(packageJson.version);
    expect(methodology).toContain(`v${packageJson.version} scoring contract`);
    expect(sampleWorkflow).toContain(`uses: cucuwang/aeoptimize@v${packageJson.version}`);

    for (const rule of allRules) {
      expect(methodology).toContain(`\`${rule.id}\``);
    }
  });
});

describe('v0.6 JSON automation contract', () => {
  it('keeps the documented top-level and page-level fields stable', async () => {
    const report = await scan({
      type: 'file',
      path: join(repositoryRoot, 'examples/github-action-sample/site/index.html'),
    });

    expect(Object.keys(report).sort()).toEqual(['overall', 'pages', 'summary', 'timestamp']);
    expect(Object.keys(report.overall).sort()).toEqual([
      'aiMetadata',
      'citability',
      'contentDensity',
      'schema',
      'structure',
      'total',
    ]);
    expect(report.pages).toHaveLength(1);
    expect(Object.keys(report.pages[0]).sort()).toEqual(['issues', 'scores', 'suggestions', 'title', 'url']);
    expect(Object.keys(report.pages[0].scores).sort()).toEqual(Object.keys(report.overall).sort());
    expect(Number.isNaN(Date.parse(report.timestamp))).toBe(false);
  });

  it('ships release and rollback instructions with the package', async () => {
    const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'));
    const releaseGuide = await readFile(join(repositoryRoot, 'docs/release-v0.6.md'), 'utf8');
    const publicVerifier = await readFile(join(repositoryRoot, 'scripts/verify-release-v0.6.sh'), 'utf8');

    expect(packageJson.files).toContain('docs/release-v0.6.md');
    expect(packageJson.files).toContain('fixtures/');
    expect(packageJson.files).toContain('examples/github-action-sample/');
    expect(packageJson.files).toContain('scripts/verify-release-v0.6.sh');
    expect(releaseGuide).toContain('## Rollback');
    expect(releaseGuide).toContain('npm dist-tag add aeoptimize@0.5.3 latest');
    expect(releaseGuide).toContain('<verified-package-sha256>');
    expect(publicVerifier).toContain('.gitHead');
    expect(publicVerifier).toContain('EXPECTED_REPOSITORY_URL');
    expect(publicVerifier).toContain('.dist.tarball');
    expect(publicVerifier).toContain('EXPECTED_PACKAGE_SHA256');
  });
});
