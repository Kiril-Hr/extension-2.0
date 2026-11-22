# DEVEX-022 · Stage 2A · Candidate CI and regressions

Stage 1 base is `a55c3355acdbf4535a8ffe7fed5ec8125797f725`. The candidate is verified on Windows by `verify-runtime.yml`. The existing `verify.yml` retains its original triggers and `workflow_call` interface.

## Package selection and isolation

The candidate workflow explicitly supplies `DEVEX_SOURCE_ROOT=packages/runtime`. `tests/source-package.cjs` validates an explicit package path. The candidate entry point also checks its real path against this checkout's `packages/runtime`; unset, whitespace-only, missing and historical selections are errors. Direct legacy test invocations without a selection still resolve `devxtension/`.

The candidate runner creates a fresh `.verification/tools/runtime-runs/run-*/` per execution. Source compilation and prepack use the selected candidate package. All test fixtures, temporary manifests, consumers, watch edits, Chromium profiles and test results are in the run directory. Both independent apps install the same tarball, and their lockfile SRI must match its SHA-512. The installed package metadata must point to `packages/runtime`. The product test also compares effective dist bytes with the installed package. Outputs include the SHA-256, package archive and inventory, per-command logs and exit codes, browser evidence and the selected source path.

## Migrated coverage

- `regression`, `lifecycle_cleanup`, `service_collisions`, `url_routing`, `react_mounting`, `react_cleanup`, `integration_contract`, `runtime-contract`, `manifest-conversion`, `factory-lifecycle` and `factory-manifest` now use the selected package.
- `factory-product` and `packaging-cleanup` build, typecheck, pack and check the installation and npm whitelist. The public type fixture tests the factory call, lifecycle return, globals and rejection of an invalid widget.
- `factory-watch` reuses the installed CLI. It checks watch regeneration, explicit rejection of a conflicting Manifest and restoration of the original production build.
- The historical VM script is still used by the default historical path. The candidate's independent VM check uses its actual generated minimal-example background. It checks MV3, injection scope, the navigation listener, subframe filtering, no-receiver fallback only on matched routes and the live receiver path. The Chrome callback stubs model these cases. Both Chromium suites also use the real extension and Chrome APIs.
- The candidate runs the same factory and minimal-example Chromium scripts. The minimal example uses the candidate tarball in its disposable copy, so it covers candidate startup and SPA reactivation independently of the larger factory fixture.

## Checkout issue and fix

The first local candidate run reached tarball installation, then the existing byte comparison failed for `dist/devex-scripts/index.js` (exit 1). The new checkout path used CRLF. npm installed the shebang file with LF. Comparison after newline normalization showed identical content. Mirroring the historical CLI-specific `eol=lf` attribute for the new path fixes fresh Windows checkout behavior and keeps the candidate source blob intact.

## Reproduction

From this branch on Windows with Node 24, install Playwright 1.56.1 under `.verification/tools`, install Chromium, and ensure the Chromium test server can bind 127.0.0.2:80. Set `DEVEX_PLAYWRIGHT_PATH` to the installed Playwright module and `PLAYWRIGHT_BROWSERS_PATH` to the selected browser cache. Run:

```powershell
$env:DEVEX_SOURCE_ROOT = 'packages/runtime'
node tests/verify-runtime.cjs
git diff --exit-code a55c3355 -- devxtension example test packages/runtime .github/workflows/release.yml .github/workflows/verify.yml
```

The candidate runner handles npm ci, compilation, packing, installs, both production builds, watch, regressions and both browser tests.

## Review boundary

Candidate verification and the historical release lane remain distinct. This stage establishes evidence for Stage 2B architectural review. Changing release sources, selecting a future npm version and publishing are separate decisions. Windows Chromium coverage uses Playwright 1.56.1 with the current browser fixture, so other platforms and Chromium versions are outside this evidence.

## Results

All nine top-level candidate commands returned 0 locally and on GitHub Windows. The product pipeline recorded 18 exit codes of 0, including all 11 migrated regression scripts. The packaging test found 59 entries. The watch regression requires an intentional nonzero build for the conflicting Manifest and verifies the following restored build. Both Chromium suites passed. Factory Chromium covers nine scenarios including DI, React, lifecycle, cleanup and SPA. Minimal Chromium exercises same-document reactivation through the actual MV3 worker. The four no-fallback probes each returned 1 as expected, and the default resolver returned the historical directory without an override.

Candidate archive SHA-256, identical locally and in GitHub Actions: `9397241b85e60270f5ec5103636b303264b4961b0f125ff5cd5914e3155ca2c2`.

- [Candidate CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45082244215) and [candidate artifacts](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45082244215/artifacts/14777671642).
- [Historical CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45082244067), including the public npm minimal-example check.

Both runs passed on infrastructure commit `be9f7daf9cae9efcd75efac1e94f04688e82c09b`. The subsequent report commit only records this evidence. The historical directories, candidate source and existing release/verification YAML have an empty diff from Stage 1. Stage 2A is ready for Stage 2B review.
