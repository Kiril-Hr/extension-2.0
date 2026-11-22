# DEVEX-022 · Stage 1 · Active package candidate

Base: `origin/main@88779392dde75602c2b37f6620df06145396a697`. Branch: `codex/devex-022-core-migration`. The candidate is packaged independently as `devxtension@1.1.0` for local tests. The published version and release workflow still use the historical release location.

## Copy inventory

`packages/runtime` contains 33 files copied from the tracked tree at the base:

- 16 production TypeScript files: `src/index.ts` and the complete `src/core/` tree. These include the factory, configuration, DI, decorators, URL matcher and React component support.
- 11 build-tool files: `lib-bild/compile-scripts/{clean,copy-lib-modules,get-entry-files}.js`, `lib-bild/config/webpack{.configuration,.dev,.prod}.js`, `lib-bild/config/webpackCompileUtils/{additionalUpdater,backgroundURLUpdater,factoryManifest,runtimeToChromePatterns}.js` and `lib-bild/devex-scripts/index.js`.
- Six package files: `.gitignore`, `LICENSE`, `README.md`, `package-lock.json`, `package.json` and `tsconfig.json`. The only content change was the package metadata `repository.directory` from `devxtension` to `packages/runtime`.

The 25 files under the historical `devxtension/src/test/`, including the Google Meet fixture and runner, and the internal `integration-test.cjs` stayed in the historical tree. The two omissions were already excluded from publication. All tracked content in `devxtension/`, `example/` and `test/` stays at the base tree. Builds and prepack ran in the candidate and in a separate temporary copy of baseline, never in those trees. The local original, AUTHOR-001 and the DEVEX-021 audit were outside the migration.

## Verification on Windows

Scratch paths below are relative to the worktree. The baseline copy, archives, unpacked packages and independent consumer live under ignored `.verification/tools/stage1/`.

| Location and command | Exit | Observed result |
| --- | --- | --- |
| Candidate and scratch baseline: `npm ci --no-audit --no-fund` | 0 each | 416 dependencies from the same lockfile. Existing deprecation and npm install-script warnings. |
| Candidate and scratch baseline: `npm run build` | 0 each | Clean, TypeScript compile and build-tool copy. |
| Candidate and scratch baseline: `npm pack --json --pack-destination <separate-directory>` | 0 each | Each prepack rebuilt the package. |
| Scratch: `tar -xf <archive> -C <separate-unpack-directory>`, then Node assertions over paths and file bytes | 0 | Same 59 paths. All files byte-identical except the expected repository.directory metadata. JS, declarations, maps, CLI, README and LICENSE identical to a fresh package from the same main baseline. |
| Independent consumer: `npm install --no-audit --no-fund` with dependency `file:../../candidate-pack/devxtension-1.1.0.tgz` | 0 | Fresh install in scratch, no Core imports or dependency on the historical build. |
| Consumer: `node node_modules/typescript/bin/tsc --noEmit` and `node ../../tests/factory-types.cjs` | 0 each | Strict fixture and installed public type contracts pass, including original call, lifecycle return and optional arguments. |
| Consumer: Node `require('devxtension')` with assertions on exports | 0 | Resolved the consumer's installed dist/index.js. Eight runtime exports, including factory, both decorators, DI, Feature and DisableFeatures. Full export parity supported by byte comparison. |
| Consumer: `npm run build` (installed `devex-scripts build`) | 0 | Webpack 5.88.2. MV3 name, webNavigation, background.js and expected host/match scope verified. The default-port warning is inherited from baseline. |
| Scratch: `node tests/factory-browser.cjs` | 0 | Chromium 141.0.7390.37, 9/9 real MV3 scenarios. Factory startup, globals, Chrome messages/storage, shared DI, React, SPA route exit/re-entry, cleanup and restart. |
| Scratch: `node tests/factory-watch.cjs` (watch/CLI portion) | 0 | Installed `devex-scripts dev` compiled and rebuilt the inline manifest after a source edit. Intentional conflicting legacy manifest returned nonzero. Restored source production build passed. |
| Worktree: `git diff --exit-code HEAD -- devxtension example test .github` | 0 | No changes in the historical trees or workflows. |

Copy the tracked `.verification/factory-consumer` sources, tsconfig and empty .env into scratch without its old lockfile. Point a new package manifest at the candidate tarball and retain the build/dev scripts. Copy factory-types, factory-browser and factory-watch into the corresponding scratch tests path. For browser verification use port 80 on 127.0.0.2, set DEVEX_PACKAGE_PATH to the candidate tarball and point DEVEX_PLAYWRIGHT_PATH and PLAYWRIGHT_BROWSERS_PATH at Playwright 1.56.1 and its Chromium binaries. The factory browser test used the existing local Chromium cache. The candidate archive SHA-256 for this run was `9397241b85e60270f5ec5103636b303264b4961b0f125ff5cd5914e3155ca2c2`.

## Stage 1 limits and next review

The comparison target is a fresh tarball from current main. Public npm 1.1.0 was published from an earlier tree. The local candidate version must never be used to overwrite it. No workflow cutover or npm publication occurred. Stage 1 leaves the original package as the verified release source. The existing CI still validates that source. A direct CI job for the new layout, path updates for hard-coded source tests and the associated packaging/release cutover require a separate decision. In particular, the historical VM check depends on a historical fixture and was excluded from the copied watch driver. The full source regression suite was not repointed to the candidate. Evidence for this stage consists of archive equality plus consumer tests against the installed candidate.

Review the duplicated tree ownership and choose the future source of truth before new behavior lands. After approval, retarget CI and package/release consumers explicitly, rerun the full suite against the new location, and select an unpublished version before any release. Stage 1 stops at the draft PR for architectural review.
