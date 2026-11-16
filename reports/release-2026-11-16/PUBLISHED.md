# DevEx 1.1.0 — verified public release

Date: 2026-11-16 (Europe/Kiev).

- Repository: https://github.com/Kiril-Hr/extension-2.0
- Integration branch: codex/github-npm-1.1.0
- Integration head: b3f6efdfdf5715d70f54b2eaf398fa33cf394df7
- Approved and merged PR: https://github.com/Kiril-Hr/extension-2.0/pull/1
- Main/released gitHead: a66c533cb467c236f69d1a2d876c7312a9ca041f
- Package: https://www.npmjs.com/package/devxtension/v/1.1.0
- Installation: npm install devxtension@1.1.0
- Public latest dist-tag: 1.1.0
- OIDC publication run: https://github.com/Kiril-Hr/extension-2.0/actions/runs/43958728454
- Provenance: https://registry.npmjs.org/-/npm/v1/attestations/devxtension@1.1.0
- Public tarball SHA1: 95a76eadf1593e89417c1bcbf226e91972743dfa
- Public SRI: sha512-WyG7n3lQgejnqXmEkB7stS/rxerzPOMDUlsrd8DMogSO/ClQIEHLgEIt/xKPsskqFnp9e4/LCQm9W5vc4NONrQ==

## Verification

PASS: clean TypeScript build, noEmit, regression, lifecycle cleanup, service collisions, URL routing, React mounting/cleanup, integration/runtime contracts, Manifest conversion, factory lifecycle/Manifest, npm pack, independent tarball install, strict public API types, consumer Webpack build, watch regeneration/conflict errors/background regression, and nine real Chrome MV3 scenarios. PR checks and the release workflow's full verification job passed on clean GitHub runners.

OIDC publish succeeded with signed provenance. The immediate post-publish smoke check failed with ETARGET because npm had accepted publication but was still processing the package. The overall initial release run is therefore red; its publish step succeeded. It was not rerun and the version was not republished. The failure is preserved in oidc-publication.log.

After registry availability, a fresh independent project installed the exact public devxtension@1.1.0. Strict TypeScript, public factory API type checks and production Webpack/MV3 build passed (published-consumer.log). The same real browser suite then ran against that project's actual built extension and all nine scenarios passed (published-browser.log and published-browser-results.json). This covers startup, global widgets/ManifestModule, real Chrome API messaging/storage, shared DI, reSetup, SPA navigation, React mounting, final cleanup and restart. No Core/DI/Chrome mocks were substituted in the browser check.

## Source, build and test changes

Source: existing author Core, decorators, DI, global participants and lifecycle integration from the verified local work were synchronized into the existing GitHub devxtension/ layout. Existing curried public API and automatic startup remain.

Build: clean/prepack pipeline, CLI and Webpack/Manifest fixes, LF shebang normalization, package metadata/version 1.1.0 and npm OIDC automation. Stale upstream generated dist is no longer tracked; fresh dist is included in npm.

Tests: existing regression and factory suites imported, CI paths made portable, ANSI-colored watch output handled, ephemeral hosted Windows HTTP reservation released for real default-port tests. Follow-up changes add bounded registry propagation waiting and optional paths to reuse the real browser suite against an independent public-registry consumer. They do not alter published framework runtime code.

## Preservation and readiness

All 12 original uncommitted workspace files remain preserved. Integration used isolated worktrees, no force-push, and no original archive modification. Source worktree used for GitHub synchronization: D:/Devex/.release/github/devxtension. The author's existing working project remains D:/Devex/extension-2.0-main/devxtension.

Ready as the verified npm framework foundation for Personal AI Tube. That application was not started or claimed tested. Lifecycle hooks remain synchronous; DI is scoped to each JavaScript context; arbitrary runtime expressions in build-time Manifest are unsupported. Application-specific Google Meet flows and future platform features remain outside this release.

The automation follow-up needs separate author review/merge approval. It addresses registry visibility timing; it is not a blocker to using the already installed and browser-verified public package.
