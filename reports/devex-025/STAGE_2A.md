# DEVEX-025 Stage 2A · Feasibility results

**Decision for review.** Use strategy C from ADR-001 when a command belongs to a specific document. Deliver to the browser-observed tabId and documentId, and fail closed when that document is gone. A frame-targeted command has a different meaning: it deliberately addresses the current occupant. The library-backed strategy B is viable when that behavior is desired. The choice turns on a reproduced delivery difference. [Recorded observations](STAGE_2A_OBSERVATIONS.json) · [Isolated consumer](../../spikes/devex-025)

## Experiment

Local Windows 10 x64, Node 24.18.0, Webpack 5.88.2 production bundles, Playwright Core 1.56.1. npm latest for @webext-core/messaging resolved to **4.0.2** during the experiment and was pinned in the consumer lockfile. Each adapter used identical worker, popup, content and harness sources in its own disposable profile. Chrome loaded the unpacked MV3 extension over CDP. A loopback HTTP server served the parent and a same-origin iframe. The popup was opened by chrome.action.openPopup(), not by navigating a regular tab to its HTML file. The browser fixture uses no DevEx implementation or privileged production configuration.

| Real browser | Native Chrome one-shot calls | @webext-core/messaging 4.0.2 |
| --- | --- | --- |
| Chromium 141.0.7390.37 | PASS | PASS |
| Google Chrome 158.0.8127.36 | PASS | PASS |

### Document targeting

The frame navigated from /a to /b in the same tab. Its frameId remained constant and its documentId changed in all four trials. Native delivery to the old document rejected with “Receiving end does not exist”. The new document's invocation counter was still empty. Sending to its new documentId succeeded, as did explicitly sending to the current frame. Code must treat stale-document failure as terminal for that target, even if the frame remains open.

The library delivered a frame-targeted request to /a before navigation and /b afterwards. Its published send options accept tabId and frameId. The strict consumer rejected a literal containing documentId. As a deliberate JavaScript boundary control, supplying both the old documentId and the valid frameId delivered to /b. The extra property gave no document isolation. This is consistent with the library's supported frame API. Avoid promising document targeting through a type cast or a wrapper that only forwards frameId.

### MessageSender as received

| Direction | Fields observed on both browsers and transports |
| --- | --- |
| Main or iframe content → worker | id, url, origin, frameId, documentId, documentLifecycle and tab. Main frameId was 0. The iframe had its own URL, positive frameId and documentId while sender.tab identified its enclosing tab. |
| Action popup → worker | id, url and origin. URL was chrome-extension://<id>/popup.html. The origin was the extension origin. No tab, frameId or documentId appeared. |
| Worker → content | id, url and origin. URL was chrome-extension://<id>/worker.js. No tab, frameId or documentId appeared. |

The library exposed the native values on message.sender. Popup and worker had identical field names, extension ID and origin. Their exact packaged paths differed. In a future receiver, check the browser-supplied identity, role-specific URL and per-handler policy. The popup URL alone does not prove the UI was visibly open or a user initiated the action. Derive the worker path from the actual generated Manifest (DevEx uses background.js). Unknown/absent metadata must not grant a privileged role. These observations cover the internal contexts in this fixture, not sandboxed, opaque-origin, cross-extension or cross-origin iframe senders.

### Worker wake

Both bundled worker entries synchronously registered the identify handler at top level, before any asynchronous operation. CDP reported an activated/stopped worker after explicit stopWorker. Navigating the iframe to /wake caused its new content script to send the first identify request. The normal message path woke the worker, returned a different per-evaluation UUID and reported the /wake sender. There was one send and no retry in the fixture. No harness evaluation in the stopped worker initiated the wake. This proves re-registration on cold evaluation for both transports. Natural idle timing, interruption mid-write, deduplication and durable state are outside this result.

### Strict TypeScript consumer

TypeScript 5.1.6 ran with strict, exactOptionalPropertyTypes, noEmit and declaration checking enabled. The consumer imports the local declaration-only version of the ADR's mapped request contract, normalizes validator output via a literal protocol definition, and independently imports the library's published declarations. Valid popup/content/worker requests and result narrowing typechecked. Nine @ts-expect-error controls passed. A second compiler invocation removed the directives in memory and produced exactly nine diagnostics in consumer.mts: six TS2345, two TS2339 and one TS2769. Cases include a union of names with an uncorrelated payload, mixed frame/document addressing, sender narrowing and the library's unsupported documentId option. This validates the proposed request types only. The browser adapters are experimental JS; runtime validation, authorization, notifications, DevEx module ownership and generation remain separate implementation gates.

## Reproduce

In spikes/devex-025 run npm ci, npm run typecheck and npm run build. Install the pinned Chromium with npx --no-install playwright-core install chromium (or select its cache via PLAYWRIGHT_BROWSERS_PATH). Run npm test. Set DEVEX_CHROMIUM_PATH to a compatible Chrome executable and repeat npm test. Each execution writes observations.json for both transports. The tracked observations file is a projection of the two archived local runs, retaining sender field names, fixture paths and verified equality relationships. Raw extension, document, tab and boot identifiers, ephemeral ports and profile data are omitted.

All build, typecheck and browser commands exited 0. Raw run artifacts are ignored in the spike directory. Windows 11 and browser versions outside the tested pair remain unverified. No production files, release workflow or public package were changed.

Stage 2A.1 repeated npm ci, strict typecheck, production fixture build and both browser runs from the main-based review worktree. Every command exited 0. The publication diff includes only this report, anonymized observations and the isolated fixture with its lockfile.
