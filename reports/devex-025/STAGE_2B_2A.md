# DEVEX-025 · Stage 2B.2A · Chromium transport smoke

## Baseline and package provenance

[PR #13](https://github.com/Kiril-Hr/extension-2.0/pull/13) was open and Draft at `6d913c305ca261d31b61df51b5a4cdd3f03bf01b`. Local worktree and remote branch checks showed the transport branch and earlier DEVEX-025 work. No separate Stage 2B.2 branch was visible. This smoke used its own worktree at the verified SHA.

Chromium **141.0.7390.37**, Playwright **1.56.1**, Windows x64, Node **24.18.0**, npm **11.16.0**, Webpack **5.88.2**. Built `devxtension@1.1.0` from the pinned source via `npm pack` and installed it in an independent consumer. The consumer lockfile resolved `file:../devxtension-1.1.0.tgz`. Tarball SHA-256 was `aeeda50de27315a894938484cb666c4c2223368f5de313d9d366e4272a5c4305`.

The [smoke fixture](chromium-transport-smoke.cjs) builds worker, content and popup entrypoints with imports from the installed `devxtension/messaging` subpath. It loads the unpacked MV3 extension in a fresh headless Chromium profile and serves test pages over loopback. The fixture uses a hand-written manifest and synchronous worker entrypoint registration.

## Test matrix

| Scenario | Observed result in both runs |
|---|---|
| Content → background | Top-frame and iframe request/response passed. The returned content sender had the expected loopback origin and tab identity. Main frame ID was zero. The iframe had a positive frame ID and a document ID. |
| Background → content | Initial document-targeted ping reached iframe `/a` exactly once. Content identified the sender as background with the installed extension ID. |
| Action popup → background | `chrome.action.openPopup()` opened the manifest action. Popup received a typed result and confirmed it in a second call. The worker classified both calls as popup and reported the exact packaged popup URL. |
| Other Chrome listener | A separate native `onMessage` listener in the same worker answered an unrelated raw message. Typed requests also succeeded with that listener registered. |
| Iframe `/a → /b` | Same tab ID and frame ID, new document ID. Targeting the old document returned `unavailable`. The replacement had zero invocations at that point. Explicit frame targeting reached `/b` once. |
| Worker stop and wake | CDP requested `ServiceWorker.stopWorker` on the activated registration and observed `activated/stopped` on that version. The first subsequent typed request from the existing iframe succeeded with the same sender metadata and a fresh worker boot ID. The fixture used no Playwright service-worker handle. |

| Operation | Exit code |
|---|---:|
| `npm ci --no-audit --no-fund` in runtime | 0 |
| `npm pack` with package prepack build | 0 |
| `npm install` from tarball in independent consumer | 0 |
| Webpack and Chromium smoke, profile 1 | 0 |
| Webpack and Chromium smoke, profile 2 | 0 |
| Runtime diff against the tested SHA | 0, empty |

## Reproduction

Use the pinned commit with the fixture from this branch. In the repository root create `.verification/tools/messaging-smoke` and a private npm project in its `consumer` subdirectory. Install Playwright 1.56.1 in an isolated tools directory and install its Chromium distribution. Set `DEVEX_PLAYWRIGHT_PATH` to that installed Playwright directory and `PLAYWRIGHT_BROWSERS_PATH` to the browser cache.

```powershell
Push-Location packages/runtime
npm ci --no-audit --no-fund
npm pack --pack-destination ../../.verification/tools/messaging-smoke
Pop-Location
$smoke = (Resolve-Path .verification/tools/messaging-smoke).Path
$consumer = Join-Path $smoke 'consumer'
npm install --prefix $consumer --no-audit --no-fund (Join-Path $smoke 'devxtension-1.1.0.tgz')
node reports/devex-025/chromium-transport-smoke.cjs $consumer
```

Each invocation creates a separate fixture directory and profile under the consumer and closes the browser at the end. Build output and profiles are outside the tracked report and harness.

## Defects and remaining scope

No transport defect was reproduced in this matrix. The stale-document rejection is the expected isolation result. The worker test covers a controlled stop followed by a new request. Natural idle, interruption of in-flight work, receiver saturation, alternate Chromium versions and broader validation and authorization cases remain outside this smoke. Generated worker integration, DevEx lifecycle and DI were outside the fixture.
