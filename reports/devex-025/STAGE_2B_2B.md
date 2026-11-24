# DEVEX-025 · Stage 2B.2B · Packaged transport integration gate

**Decision — CONDITIONAL.** The installed candidate passes the acceptance matrix on both pinned browser versions after one P2 correction. Approval applies to the corrected candidate and the scoped one-shot transport. Preserve settlement-based receiver accounting. A first-call timeout observed once in Chromium 141 under concurrent local load has no confirmed cause. A separate intermittent manifest-read failure in the existing watch test is also recorded below.

## Provenance

| Ref | Verified commit |
|---|---|
| main | `65a5c8bb0203aa1016630805de8d4bf950017427` |
| Draft PR #13, implementation baseline | `6d913c305ca261d31b61df51b5a4cdd3f03bf01b` |
| Draft PR #14, smoke evidence | `99fd5373151933c26cd3c8ba9cdd42e5edeba78b` |
| Smoke cherry-pick, with original commit recorded by Git | `e6eb79b` |
| Corrected transport and browser fixture | `111493b4c3e2dc2c407e3b66c052f6c19a1e70c1` |
| Final tested code and checks, including disposal counters | `67ad0f6fe28999ba0ac7c209c345a05c88b7b57f` |

The verification branch starts at PR #13. The PR against main includes that implementation. Its report-only commit follows the tested code SHA. GitHub exposes the final branch SHA as `head.sha` on [PR #15](https://api.github.com/repos/Kiril-Hr/extension-2.0/pulls/15). Starting Historical and Candidate checks passed on [PR #13](https://github.com/Kiril-Hr/extension-2.0/pull/13/checks) and [PR #14](https://github.com/Kiril-Hr/extension-2.0/pull/14/checks). Requirements come from [accepted ADR-001](ADR-001.md) and [the feasibility evidence](STAGE_2A.md).

## Packaged browser matrix

Windows x64, Node 24.18.0, TypeScript 5.1.6, Webpack 5.88.2, Playwright 1.56.1. Both fresh-profile runs loaded a Webpack production extension built from a consumer whose lockfile pointed to the locally packed tarball. Baseline SHA-256 was `aeeda50de27315a894938484cb666c4c2223368f5de313d9d366e4272a5c4305`. Corrected tarball SHA-256 was `95da1a8f4a83eebdfb2e7165d736e7e3cf2ee000750bacc807d3e0e8cf6f467e`. The harness drives the extension's isolated worlds through CDP and observes real Chrome messaging callbacks. Sender metadata in these tests comes from Chrome.

| Scenario | Chromium 141.0.7390.37 and Chrome 158.0.8127.36 |
|---|---|
| Content, worker and popup identities | Two top-level tabs had distinct tab IDs. Permitted iframe shared its tab ID with the parent and had a positive frame ID. Action popup opened via Chrome API and the handler identified its exact packaged URL. Content received the expected extension ID and background role on a worker request. |
| Per-endpoint sender policies and ACL | Disallowed subframe, second loopback origin, incorrect popup path and a content sender selecting a popup-only command with a popup role in its payload each yielded `forbidden`. Measured protected handler delta **0 per case**. Top-frame and authorized iframe positive controls succeeded. |
| Dispatch and coexistence | Unbound name returned `noHandler`. Wrong version returned `unsupportedVersion`. Foreign protocol and wrong destination received no typed reply. Handler delta **0 per case**. A separate native listener returned observation snapshots while the typed listener was installed. |
| Business results | One handler returned its declared domain error. A notification returned JSON-null admission while its single handler was still waiting on a latch. |
| Document targeting | Repeated iframe navigation independently in each of two tabs. Tab and frame IDs persisted, document ID changed. A stale request made one native send, returned `unavailable`, and invoked **0** replacement handlers. Explicit new-document and frame requests reached the replacement **once each**. Other-tab handler delta **0**. |
| Sender and global capacity | Eight outstanding handlers from one document. After eight client deadlines, a ninth call yielded `busy` with **0** fresh invocations, including after endpoint reopen. Seven more senders filled the 64 slots. A ninth sender's 65th attempt yielded `busy` with **0** fresh invocations. The latch released all 64. The 56 live clients received their own correlation values, and the eight timed-out operations each retained one settlement. A later request succeeded. |
| Local abort and late reply | One outgoing send, one handler invocation, one local `aborted` settlement. The late native callback arrived after releasing the worker latch. Re-reading the result still showed one settlement. |
| Tab closure | The worker made one document-targeted send. The recipient entered its handler once. Closing the recipient tab yielded `channelClosed`. |
| Worker interruption and cold evaluation | One held invocation was observed before stopping the activated worker. CDP observed the same version as activated/stopped. The interrupted client settled once. The first new request from the surviving document obtained a fresh worker boot ID and the same sender. Old-handler invocations after restart **0**. Both runs returned `channelClosed` for the interrupted request. |

The 64-slot test used business handler entry counts and independently visible latches. It reproduces the performance and capacity investigations on packaged browser code. In a persistent realm an indefinitely stalled handler can keep its slot indefinitely. Early release would allow more underlying work than the limit. The optional cooperative wrapper remains an architectural candidate. These tests cover controlled worker stop, and claims about completion of external side effects remain outside the evidence.

## Defect and controls

**P2 — Array subclass accepted as wire JSON.** A benign `class Items extends Array {}` passed baseline validation, reached the transport once and invoked the echo handler once. The rejection regression exited 1. The walker checked `Array.isArray` and skipped the ordinary prototype check for every array. The minimal correction recognizes the intrinsic array prototype, including ordinary arrays from another JS realm. A trial identity-only check incorrectly rejected the foreign ordinary-array control and was discarded. Corrected result is `invalid`, **0** sends and **0** handler invocations. Ordinary local and foreign arrays remain accepted. No transport schema, permission, wire format or public handler signature changed. [JSON walker](../../packages/runtime/src/messaging/wire.ts) · [Reproduction](verification/installed.cjs)

| Independent check | Evidence |
|---|---|
| Browser-protected metadata | The controlled callback fixture substitutes a foreign extension ID and individually removes id, URL, origin, tab, frame ID and document ID. Every case yielded `forbidden` with **0** handler invocations. These checks cover receiver logic for constructed inputs. The real-browser sender tests above cover authenticity. |
| Invalid input | Cycle, undefined, NaN, infinity, excessive depth, wide oversized object, oversized string and unknown application key each returned `invalid` before transmission, with **0** sends and **0** business invocations. The application validator throws on extra keys. Extra wire-envelope key rejected with **0** business invocations. |
| Invalid response | Handler invoked **once**, returned malformed success data, response validator rejected it and caller received `invalid`. |
| Cleanup | With eight held native callbacks, client disposal took timers and abort listeners from **8 to 0** each. All eight clients settled once. Late callbacks left the outcome unchanged. Handler delta **0** in this held-callback fixture. Endpoint disposal removed the final native listener. |
| Strict consumer | Public CJS require, native ESM import and strict ESM Webpack entry resolved. With directives, strict tsc exited 0. With all directives blanked while preserving line numbers, compilation failed exactly at the 14 intended statements. Positive correlated tuple unions, role and target restrictions, exclusive document/frame selectors, handler payload/sender, response/domain narrowing and notification checks are exercised. |

## Resource observations

| Encoded body | Iterations | One validation walk, wall / CPU µs | Typed callback request, wall / CPU µs | Post-GC heap delta |
|---|---:|---:|---:|---:|
| 1,024 B text | 150 | 12.9 / below clock resolution | 196.8 / 213.3 | +28,120 B |
| 16,384 B text | 150 | 76.1 / 206.7 | 766.9 / 733.3 | +8,272 B |
| 65,536 B text | 150 | 334.6 / 213.3 | 3,659.6 / 2,913.3 | +27,192 B |
| 64,010 B dense array | 25 | 9,096.3 / 9,400.0 | 97,552.5 / 75,000.0 | +56,688 B |

Separately, 25 warmed real content → worker identify requests measured a median of **1.5 ms** (maximum 2.9 ms) on Chromium 141 and **1.8 ms** (maximum 3.1 ms) on Chrome 158. These end-to-end latencies include browser dispatch, validation and business response processing. Windows process CPU accounting has coarse resolution for small batches and aggregates process threads.

Node timings use minimal validators, same-process callback delivery and one sequential client. Validation is timed separately using the installed wire walker. CPU numbers are process user plus system time. Heap values are post-forced-GC differences for the entire measurement batch, sensitive to warmup and collection timing. They do not measure peak memory or worker RSS. Dense arrays require enumeration and descriptor inspection per element. Prior Stage 2B.P measurements likewise showed higher cost at similar wire size. Receiver deadlines have the local-only meaning specified in the ADR.

## Regression results and residual uncertainty

- Corrected candidate pipeline **14/14 exit 0** locally, including strict transport compilation, factory/DI/lifecycle/React regressions, Manifest tests, npm pack, tarball integrity verification, two independent consumer installs, public exports, Webpack, CLI watch, factory and minimal Chromium scenarios, Dev Reload, installed-package controls and the new MV3 matrix. Chrome 158 matrix separately exited **0**.
- GitHub verified the transport correction at `111493b` through [Historical CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45277718542), [Candidate CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45277718513), and [release dry run](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45277718388), including the packaging job with publish skipped. The [PR checks tab](https://github.com/Kiril-Hr/extension-2.0/pull/15/checks) tracks the latest head.
- On the original PR #13 package one Chromium 141 trial running alongside Chrome 158 and local regressions timed out on the first identify call. The unchanged original 141 package passed the standalone repeat at the same five-second deadline. The corrected tarball passed separately. No captured trace pinpoints where the initial call lost time. Keep the cold-start observation open.
- An intermediate local run exited 1 in the existing `factory-watch.cjs:18` on `JSON.parse` with unexpected end of input. That poll reads the manifest while watch is regenerating it. The failure occurred outside the messaging assertions. The full corrected run passed without altering the watch test or its timeout.

At the verified code SHA, diff against main is empty for the historical source trees, factory and DI source, module lifecycle, build tools, worker generator and workflow definitions. The candidate production manifest receives no fixture grants. Package name and version are `devxtension@1.1.0`. The correction touches only the wire validator within production code.

Reproduce locally with `node tests/verify-runtime.cjs` and the environment settings from [candidate CI](../../.github/workflows/verify-runtime.yml). To exercise Chrome 158 set `DEVEX_CHROMIUM_PATH` to its executable and run `node reports/devex-025/verification/browser.cjs <installed-consumer> 158.0.8127.36`. The standalone [installed-package controls](verification/installed.cjs) accept the consumer path and require `node --expose-gc`. The harness logs per-scenario observations and fails on assertion errors. Independent browser controls use a hand-built manifest. Production generator and lifecycle integration belong to later work.
