# Changelog

All notable user-visible changes will be documented here. The project follows Semantic Versioning after the v0.6 evidence baseline is released.

## Unreleased

### Changed

- Reframed the score as deterministic content readiness rather than a prediction of ranking or AI citation.
- Classified FAQ and `llms.txt` as optional, zero-point signals.
- Removed the exact-one-H1 and fixed meta-description-length assumptions.
- Changed quantitative-content guidance to flag unsourced claims instead of rewarding more numbers.
- Stopped inferring `FAQPage` structured data from question headings.
- Limited CI support to maintained Node.js LTS lines and refreshed dependencies.
- Added methodology, contribution, security, roadmap, and root GitHub Action files.

### Security

- Updated runtime and development dependencies to remove known npm audit findings present in the previous lockfile.

## 0.5.3 — 2026-04-15

- Added the `aeoptimize` executable alias.
- Synchronized CLI, Action, and plugin version metadata.
