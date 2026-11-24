# DEVEX-025 · Stage 2B.2C · Stability gate

**Recommendation — BLOCKED.** Chromium 141 reproduced the five-second first-request timeout in all six fresh-profile attempts made during concurrent local work. Five serial cold-start attempts passed. The failure remains unresolved. The Manifest watch failure has a localized test-harness correction and a passing split-write control.

## Baseline and environment

PR #15 was open and Draft at `d5fcadb9f881baed05da3a407341112e37b20aed`. This worktree starts at that exact SHA. The diagnostic and watch correction commit is `31898d075347d76253a1efc28185bd42e50e3ac2`. The final report commit follows it and is the verified head on [Draft PR #16](https://github.com/Kiril-Hr/extension-2.0/pull/16). That PR targets main and includes the implementation and verification already present in PR #15.

Windows x64, Node 24.18.0, Playwright 1.56.1, bundled Chromium **141.0.7390.37**, headless, disposable persistent profiles. Tests used the independently installed Stage 2B.2B tarball with SHA-256 `95da1a8f4a83eebdfb2e7165d736e7e3cf2ee000750bacc807d3e0e8cf6f467e`. The local candidate rebuild produced the same digest.

## First identify request

The opt-in [browser harness](verification/browser.cjs) observes CDP worker version events from a page session enabled before loading the extension. The worker emits best-effort timestamped evaluation, listener registration, handler entry and return markers to the loopback fixture. The harness records the request timestamp, native callback timestamp, local settlement and outbound send count. Worker trace markers can themselves be delayed. CDP observations are host-receipt times. The check uses no Playwright worker handle and does not wait for activation before sending. No deadline or retry policy changed.

| Trial | UTC start of first identify | Observed result |
|---|---|---|
| Serial, five fresh profiles | Nov 23, 22:33:47.885 through 22:34:17.405 | **5 pass / 0 fail**. Each sent once and settled after 118–369 ms. All five recorded evaluation, registration, entry and return. Four exposed an activated CDP update before profile teardown. |
| Two launches against active local regression workload | 22:35:27.974, 22:35:41.391 | **0 pass / 2 fail**. Both stopped at the five-second local timeout, with CDP last at `new/starting`. |
| One simultaneous two-profile trial during the local regression workload | 22:36:35.343, 22:36:39.578 | **0 pass / 2 fail**. Both timed out, with CDP last at `new/starting`. The request intervals overlapped. |
| Two launches during local regression workload, worker/CDP instrumentation disabled | 22:39:36.980, 22:39:56.927 | **0 pass / 2 fail**. Both sent once and timed out. The fixture did not collect callback or worker phase timestamps in this mode. |

Example serial timeline, attempt 1. Request **22:33:47.885Z**, worker evaluated **47.979Z**, listener registered **47.986Z**, handler entered **47.995Z**, handler returned **47.996Z**, CDP activated observed **47.997Z**, native callback **48.001Z**, local result **48.003Z**. A successful request may be sent before observed activation.

Example failing timeline, overlapping pair attempt 1. CDP `new/starting` at **22:36:34.971Z**, single outbound request at **22:36:35.343Z**, local timeout **22:36:40.348Z**. All four traced failures lacked any worker evaluation, listener, handler or return marker and any native callback before the deadline. The evidence points to startup or delivery before observed handler execution. It provides no evidence of a slow handler or lost reply after execution. CPU saturation, browser process scheduling, extension initialization and debugger attachment behavior remain hypotheses. Runs overlapped existing local work, and the experiment did not isolate individual processes or record system CPU counters. A retry in a quiet profile cannot close this failure.

To reproduce, set `DEVEX_PLAYWRIGHT_PATH` and `PLAYWRIGHT_BROWSERS_PATH` as in candidate CI. Start with a consumer that has the verified tarball installed:

```powershell
node reports/devex-025/verification/browser.cjs $consumer 141.0.7390.37 --cold-only --cold-trace
```

Use fresh invocations in sequence, then launch two copies from separate shell jobs while the candidate pipeline is active. Repeat without `--cold-trace` as an instrumentation control. Capture stdout and stderr per invocation. The control with tracing disabled still uses the packaged Typed Messaging client and the existing five-second default.

## Manifest watch race

The generator serializes an object with `JSON.stringify` and writes the destination via `writeFileSync`. The original watcher assertion polled `JSON.parse(readFileSync(...))` concurrently. The destination can be opened and truncated while a reader can still access it. A disposable preload stretched that interval while supplying the generator's original bytes at completion. Original watcher exited **1** with `Unexpected end of JSON input` after the preload logged truncation at **22:37:55.560Z**. The corrected watcher exited **0** after truncation at **22:39:05.034Z** and completion of valid JSON at **22:39:05.797Z**. It also passed build, conflict and background VM assertions. The controlled reproduction establishes the reader/writer race as a sufficient cause of the observed error. The original uninstrumented failure had no file snapshot. There is no evidence of persistent invalid generator output or unrelated filesystem interference.

An intermediate experiment waited for another Webpack success banner and failed the same control. A separate compilation can emit that banner before the target rewrite. The final watcher polls for parseable JSON with the expected version. It tolerates a transient `SyntaxError` inside the existing deadline. A persistently malformed file fails with the last parse error as cause. Filesystem errors still surface. [Watch test](../../tests/factory-watch.cjs)

The control can be recreated as a Node preload in the candidate test's disposable scratch directory. Compare `factory-watch.cjs` from the pinned baseline with the corrected version in equivalent scratch consumers. Pass the preload to Node and its watch child through `NODE_OPTIONS=--require /absolute/path/to/preload.cjs`.

```js
const fs = require('node:fs')
const path = require('node:path')

const write = fs.writeFileSync
fs.writeFileSync = function (file, data, options) {
  if (typeof file !== 'string' || path.basename(file) !== 'manifest.json' || typeof data !== 'string') {
    return write.call(this, file, data, options)
  }
  if (JSON.parse(data).version !== '1.0.1') return write.call(this, file, data, options)

  const fd = fs.openSync(file, 'w')
  try {
    console.error(new Date().toISOString() + ' control: truncated manifest')
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 750)
    write.call(this, fd, data, options)
    console.error(new Date().toISOString() + ' control: finished valid manifest')
  } finally {
    fs.closeSync(fd)
  }
}
```

## Regression and integration risk

The installed-package controls passed on the candidate, including strict TypeScript, all 14 expected type errors with directives removed, sender authorization, correlation, cleanup and package resolution. The local full candidate run passed the messaging controls, Chromium matrix, factory and minimal browser scenarios and Dev Reload. That run's watch script was snapshotted before the final polling change. The final watch change passed separately with the split-write control. [PR checks](https://github.com/Kiril-Hr/extension-2.0/pull/16/checks) track the complete published branch.

The Stage 2B.2C diff contains test code and this report. It preserves production Messaging, ID targeting, single outbound sends, sender ACLs, settlement-based slot accounting and Chrome permissions. The existing real-browser matrix checks those guarantees. The reproducible startup failure blocks the integration recommendation despite the passing ordinary regression path. Isolate the startup failure below the transport boundary before changing production or accepting the gate.
