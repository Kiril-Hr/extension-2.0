# DEVEX-024 · Dev Reload MVP

[Draft PR #10](https://github.com/Kiril-Hr/extension-2.0/pull/10) · Branch `codex/devex-024-dev-reload` · Implementation `4595eeafb7a15506c8a5dc05f2bdfc285f03d494` · [Architecture and alternatives](ARCHITECTURE.md)

## Baseline

[PR #9](https://github.com/Kiril-Hr/extension-2.0/pull/9) contained the factory-browser harness fix and its report. Its three checks passed on `34a0871`. It was integrated by merge commit `234930e7b57094f54f1e4455e5deac3f970db05f`. Both post-merge workflows passed before DEVEX-024 implementation began. [Historical main CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45183589384) · [Candidate main CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45183589570)

## What changed

| Files | Responsibility |
| --- | --- |
| `packages/runtime/lib-bild/devex-scripts/index.js`, `dev.js` | CLI dispatch, Webpack watch, success/error handling and shutdown. |
| `packages/runtime/lib-bild/devex-scripts/reload-controller.js`, `chromium.js` | Serialize successful snapshots, manage the browser and wait for fresh MV3 activation. |
| `packages/runtime/lib-bild/config/webpack.configuration.js` | Report generator failures as watch compilation errors and continue tracking inputs. |
| `packages/runtime/package.json`, `package-lock.json`, `README.md` | Pin the Node-side browser driver, document browser installation, URL selection, shutdown and watch-only mode. |
| `tests/dev-reload.cjs`, `tests/verify-runtime.cjs`, `tests/factory-watch.cjs` | Browser acceptance test on the installed candidate, candidate CI integration and isolation of the existing compilation-only test. |
| `reports/devex-024/ARCHITECTURE.md`, `FINAL_REPORT.md` | Design comparison, commands and evidence. |

Production factory API, lifecycle, DI and decorators have an empty source diff. The three historical directories and workflows also have an empty diff against the baseline. The package version remains 1.1.0. The published CLI acquires this feature only through a future release.

## What the browser showed

An early test sampled the rendered module before the worker's reply arrived. The final test waits for both the DOM and the actual reply. A separate Chrome 158 trial showed the updated runner and an empty worker reply after immediate navigation. In a protocol probe on that installation, the second load returned at 1546 ms, the previous worker became redundant at 1556 ms, and the replacement activated at 1807 ms. This establishes that command completion can precede activation. The adapter subscribes before installation and waits for a different activated version at the expected extension URL. It then refreshes the retained tab.

The acceptance test uses the installed candidate CLI, a disposable copy of minimal sources, a fresh profile and a real HTTP server. The page reports the rendered module and runner, its document identity, its current SPA path, the browser's Manifest version, and a reply carrying the worker's Manifest version and per-instance UUID. A separate real tab counts page loads. Three rapid edits arrive while an actual recovery navigation is held open.

| Verification on Windows 10 x64 build 19045, Node 24.18.0 | Result |
| --- | --- |
| Full `node tests/verify-runtime.cjs` with the candidate selected, Chromium 141 for existing suites and installed Google Chrome 158.0.8127.36 for Dev Reload | Exit 0. Clean build, no-emit typecheck, regression, DI, lifecycle, factory, React, Manifest, CLI watch/build, tarball and independent installation passed. |
| `node tests/dev-reload.cjs <installed-minimal>` using the identical tarball and Chromium 141.0.7390.37 | Exit 0. Runner, module and Manifest changed separately. The managed page received fresh content and a new worker reply. Its SPA URL survived. |
| Syntax error, invalid inline Manifest, recovery and rapid edits | Passed in both browsers. The syntax-error page retained its document and worker across multiple observations. Correcting the Manifest produced the updated browser version. Final content matched the last edit, the navigation overlap check stayed clear and the separate tab loaded once. |
| Shutdown | Both CLI runs exited 0 after `q`. The tests verified that the browser PID no longer existed. A separate default headed `devex-scripts dev` smoke in the installed minimal consumer also completed its first reload and exited 0. |
| Packaging and production | 62 files in the candidate inventory. Local tested archive SHA-256 `412432a68ac78d8df1cb644db668b73be7cf469cf4fd6087ff99898ea4ef7f62`. The minimal production Manifest retained only its existing `webNavigation` permission and example.com host grant. Production runner/background passed the development-marker check. |

The implementation commit passed [Historical CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45200454209), [Candidate CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45200453798), and the automatic [release dry run](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45200453651). The publish job was skipped.

## Reproduction and limits

Use Node 24 and select `packages/runtime` via `DEVEX_SOURCE_ROOT`. Follow the Chromium installation and disposable-runner setup in [candidate CI](../../.github/workflows/verify-runtime.yml). Run `node tests/verify-runtime.cjs`. To repeat just the browser scenario, pass the generated run's `examples/minimal` directory to `node tests/dev-reload.cjs` following its production build. The Windows test binds `127.0.0.2:80` to exercise the existing DevEx default-port URL semantics. Use the [consumer instructions](../../packages/runtime/README.md) for interactive development.

Windows 11 desktop was not tested separately. Browser policy must permit unpacked extensions and the CDP extension-loading command. The selected page loses in-memory state on reload, and its server must handle its current SPA URL. Browser startup or worker activation failures stop the session with an error. Watch recovers from compilation and static Manifest errors. Browser closure and temporary profile ownership belong to this development session. No extension permission is added. DEVEX-024 remains a draft; no npm publication was performed.
