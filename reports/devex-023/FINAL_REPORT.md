# DEVEX-023 · Historical Chromium CI

Base: `298d23c6e089f94cc223e5fb2120aec2b58da121`. Test fix: `49fc7de35bf2cfb0996ce233595f1664af8c275a`. [Draft PR #9](https://github.com/Kiril-Hr/extension-2.0/pull/9).

## What failed

The [historical main run](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45169606777/job/137675373003) reached the line following the assertion that the content script had received the extension name from the background reply and mounted React. At that line, `context.serviceWorkers()[0]` was falsy and no new event was observed for 30 seconds. The earlier [successful historical run](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45085493953/job/137403034191) reported successful Chrome messaging and storage. Both used Playwright 1.56.1 with Chromium 141.0.7390.37 on Windows. The failed log has no target or registration snapshots. Its exact worker state and the reason Playwright had no handle remain unresolved.

## Confirmed test-harness defect

Native Chromium launched with a new profile and the unpacked factory fixture. The diagnostic polled the browser's CDP /json/list without attaching a debugger, observed the background target, opened the matched HTTP page and waited for natural target disappearance. Then Playwright connected over CDP. The page already held the real background reply and one React mount. There were zero visible Playwright workers. The old wait failed in 30,009 ms in the first reproduction and 30,011 ms when testing the final patch. Final diagnostic from the second reproduction, with the extension ID omitted:

```text
native worker target observed
CDP target absent after idle
messaging replied, React mounted, Playwright live workers: 0
old passive wait: timeout at 30011 ms
registered worker: activated / stopped
extension-origin chrome.storage.local.factoryProbe: true
```

One other native attempt did not observe target disappearance within its 90-second diagnostic window. The repro establishes that a valid, dormant registration can produce the same timeout. It does not prove natural idle occurred on the original CI runner. Chrome documents that extension workers may stop when idle and restart on incoming events. [Chrome MV3 worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

## Fix and controls

Only [factory-browser.cjs](../../tests/factory-browser.cjs) changes behavior. The test launches a fresh temporary persistent profile. It still requires the real background reply, checks the generated MV3 Manifest and uses the matching activated CDP registration to identify the extension origin. It opens the Manifest in that origin and polls the awaited Chrome storage value. No future Playwright serviceworker event is needed. CDP and storage waits are bounded at 30 seconds each. Browser version, matching registration status, running status, target and worker counts are captured in background-diagnostics.json on success or failure.

A preliminary async waitForFunction predicate did not reject the absent write at the storage step. The final explicit poll awaits each value, then checks exact boolean true. The negative controls only modify disposable copies of a built extension. No test fixture or source copy is changed by production CI.

| Windows verification | Result |
| --- | --- |
| Install Stage 1 historical baseline tarball into a separate fixture and run its production build | Exit 0 for install and Webpack. |
| Five consecutive `node tests/factory-browser.cjs` invocations against that fixture with fresh profiles | Exits 0, 0, 0, 0, 0. All nine scenarios each time. Every diagnostic saw one running/activated background target and no page errors. |
| Replace background in a disposable extension copy with a genuine Chrome responder that omits the storage write | Exit 1, explicit factoryProbe storage assertion after successful messaging. |
| Replace background in a disposable extension copy with a script without the message handler | Exit 1, timeout waiting for its real reply before reaching the storage check. |
| Natural idle, then run the final storage helper with no live worker | Exit 0. CDP registration was activated/stopped. |

The first exploratory smoke series had four successes and a fifth launch blocked by the parallel diagnostic's use of 127.0.0.2:80. The final five-run series and negative controls ran sequentially. Local diagnostic logs are in the ignored `.verification/tools/devex023/` folder. CI logs and generated background diagnostics are in the artifacts below.

## CI evidence and limits

- [Historical CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45177739157) passed. [Historical diagnostics](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45177739157/artifacts/14819677981)
- [Candidate CI](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45177739131) passed. [Candidate diagnostics](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45177739131/artifacts/14820288134)
- [Automatic PR release dry run](https://github.com/Kiril-Hr/extension-2.0/actions/runs/45177739162) passed verification and packaging. Publish was skipped.

These runs validate the test-fix commit. The report-only follow-up records those results. The historical main run remains the original failure record. There was no merge or npm publication. Git diffs for devxtension/, example/, test/, packages/runtime/ and workflows are empty.
