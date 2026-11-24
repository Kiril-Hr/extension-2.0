# DEVEX-025 · Stage 2B.2D · MV3 first-request isolation

**Classification A — browser worker startup and scheduling under sustained CPU contention. Integration recommendation: CONDITIONAL.** On the tested Windows 10 machine, adding four CPU-bound competitors made both native and packaged Typed Chromium 141 requests miss the five-second deadline before handler execution. Removing the load allowed the original message to execute. The effect persisted outside Playwright. An already-registered listener could also be delayed. Chrome 158 handled the same workloads within the deadline. This identifies the failing boundary; the Chromium subsystem, Windows scheduler policy and internal queue responsible remain undetermined.

**244 independent profile attempts** across six series: 88 in the preliminary load-before-activation series, 88 in the primary matrix, 12 attachment controls, eight standalone launches, eight reduced-load probes and 40 stopped-worker controls. The preliminary series includes ten unmet activation prerequisites, and one standalone profile produced no client outcome. Ordinary regression runs are additional.

## Baseline and method

Draft [PR #16](https://github.com/Kiril-Hr/extension-2.0/pull/16) was open at `3ab56aa1afe277854dd019a329442447055b3b37` when the isolated worktree was created. The production package tree matches the verified Stage 2B.2B candidate. Webpack resolved the public `devxtension/messaging` export from the independent consumer's installed 1.1.0 tarball (SHA-256 `95da1a8f4a83eebdfb2e7165d736e7e3cf2ee000750bacc807d3e0e8cf6f467e`). The native build imports no DevEx transport. [Accepted delivery contract](ADR-001.md) · [Previous failure](STAGE_2B_2C.md)

Windows 10 Pro x64 build 19045, Intel i3-7020U, four logical CPUs, 8,070 MiB physical RAM, Node 24.18.0, Playwright 1.56.1. The driver asserted each browser version. Chromium 141.0.7390.37 is Playwright's full Chromium; Chrome 158.0.8127.36 is the installed Google Chrome executable. Different branded builds on one Windows machine cannot identify the upstream commit responsible for a difference.

Each Webpack production bundle was built before measuring. Both manifests use the same MV3 background entry and a loopback-only content script. Both handlers register synchronously at top level and return the same string. The native client has the same 5,000 ms local deadline as the unmodified Typed client. A fixed once-only DOM event triggers the single null-payload probe on the lab page. There is no general routing bridge. The normal regression fixture remains the authority on authorization and document isolation.

Each matrix attempt launches a fresh disposable, headless persistent profile. Both fixtures use the same `Extensions.loadUnpacked` method, sandbox and page driver. **Cold** means first installation with no activation wait. Installation starts the worker on its own, so the registration can beat the first send. **Activated** means the driver observed CDP `activated/running` before sending. In the main matrix the CPU load for that arm starts *after* activation, enabling a real send to an already-running worker. A separate load-before-activation series measures the ability to reach that prerequisite and counts setup failures separately.

Quiet means no injected load. The CPU treatment starts four independent Node worker threads, each running an arithmetic loop and acknowledging startup. The host launches one browser at a time. Five rounds rotate cell order; an additional eight first-install attempts disable optional worker tracing, the worker observer page and the ServiceWorker CDP domain. Playwright and the CDP unpacked loader still operate in that control. CPU is the busy fraction of OS logical-CPU time over the observation interval; the one-second prelaunch sample measures ambient activity. Free RAM is system-wide and RSS covers the Node driver including load threads. Neither is an extension heap measurement.

Host epoch milliseconds record browser launch/ready, unpacked load start/return, CDP transitions and HTTP trace receipt. Worker-local epoch milliseconds record entry to the first worker script, listener registration and handler invocation. Content-local stamps record start, the actual native send, native callback and local settlement. CDP event arrival is an observation, not the instant the browser internally changed state. Worker HTTP tracing is best effort; successful traced trials also allow reading the in-worker marks after the measured request. The browser stays open for a separate 12 seconds after timeout, preserving the original in-flight message. No test resends it.

[Harness](cold-start/experiment.cjs) · [Native listener](cold-start/native-worker.mjs) · [Typed listener](cold-start/typed-worker.mjs) · [Content timestamps](cold-start/content.mjs)

## Main paired matrix

80 traced profiles, five independent attempts in every cell, plus eight plain first-install controls. All 88 submitted exactly one native message. No setup errors. Latency is native submission to client settlement. Percentiles use the nearest rank; with five measurements p95 is the observed maximum. A native callback received after the client timed out counts as a timeout.

| Browser | Fixture | State | Load | Success / sent | Timeout | On-time ms p50/p95 | Native callback after timeout |
|---|---|---|---|---:|---:|---:|---:|
| 141 | native | cold | quiet | 5 / 5 | 0 | 157/289 | 0 |
| 141 | native | cold | CPU | 0 / 5 | 5 | — | 0 |
| 141 | native | activated | quiet | 5 / 5 | 0 | 11/26 | 0 |
| 141 | native | activated | CPU | 0 / 5 | 5 | — | 5 |
| 141 | typed | cold | quiet | 5 / 5 | 0 | 101/222 | 0 |
| 141 | typed | cold | CPU | 0 / 5 | 5 | — | 0 |
| 141 | typed | activated | quiet | 5 / 5 | 0 | 16/34 | 0 |
| 141 | typed | activated | CPU | 0 / 5 | 5 | — | 5 |
| 158 | native | cold | quiet | 5 / 5 | 0 | 4/40 | 0 |
| 158 | native | cold | CPU | 5 / 5 | 0 | 3/5 | 0 |
| 158 | native | activated | quiet | 5 / 5 | 0 | 4/7 | 0 |
| 158 | native | activated | CPU | 5 / 5 | 0 | 3/6 | 0 |
| 158 | typed | cold | quiet | 5 / 5 | 0 | 7/14 | 0 |
| 158 | typed | cold | CPU | 5 / 5 | 0 | 5/6 | 0 |
| 158 | typed | activated | quiet | 5 / 5 | 0 | 7/13 | 0 |
| 158 | typed | activated | CPU | 5 / 5 | 0 | 4/5 | 0 |

Under four-thread load Chromium 141 timed out in all **20/20** traced requests across the two states and fixtures. Without injected load it succeeded in **20/20**. Chrome 158 succeeded in **40/40**. The eight plain controls reproduced the same first-install split: both 141 CPU attempts timed out, the other six succeeded. Disabling optional tracing did not remove the failure. [Main observations](cold-start/matrix.jsonl)

The two worker states explain different parts of the same symptom.

- **First installation under load, Chromium 141.** In 10/10 traced attempts CDP stayed at `new/starting`. No worker evaluation, registration, handler entry or native callback was observed through the deadline plus 12 seconds. All 60 on-time traced attempts in the matrix recorded evaluation, registration and handler entry with the corrected collector.
- **Already activated under load, Chromium 141.** In 10/10 attempts listener registration preceded submission by 384–974 ms. Handler entry was delayed **5,219–9,497 ms after submission**. The native callback arrived **1–6 ms after handler entry** and carried a valid response in all ten. The client had already settled. An activation barrier alone cannot ensure timely delivery. The observed gap includes native dispatch and worker scheduling; the experiment cannot timestamp Chrome's internal message queue.
- **Actual state at first send.** All 20 traced ungated Chromium 141 submissions preceded observed activation or had no activation event. Only three of 20 Chrome 158 submissions preceded observed activation. The fresh-install comparison therefore also measures how quickly the browser can prepare the worker. The stopped-registration control below independently ensures both browsers start from an observed stopped worker.

Across the 88 profiles, launch-to-ready p50/p95 was **1,065/2,063 ms**. Across traced runs, whole-interval host CPU p50/p95 was **98/100%** without injected work and **100/100%** with it. The prelaunch sample ranged **2–99%**, median **52%**. Browser startup itself consumes CPU; “quiet” does not mean an idle machine. Free RAM across the before/after observations was **1,549–2,448 MiB**, and driver RSS was **102–190 MiB**. Traced completed profiles reported one browser, five or six renderers, a GPU process and network and storage services. The data contain per-trial process counts and cumulative driver user/system CPU deltas in microseconds. They do not identify an individual Chromium thread or measure browser-private working sets.

## Confirmed stopped-worker wake-up

Forty additional profiles removed the ambiguity around Chrome 158's fast first activation. The extension first activated in a fresh profile. The driver prepared the content page, explicitly stopped the worker with CDP, observed `activated/stopped`, enabled the selected load and checked that the last observed state was still stopped immediately before triggering the first send. The recorded stop preceded native submission in **40/40**. No Playwright worker handle was needed to trigger wake-up.

| Browser | Native quiet | Native CPU | Typed quiet | Typed CPU |
|---|---:|---:|---:|---:|
| Chromium 141 | 5/5 | 0/5 | 5/5 | 0/5 |
| Chrome 158 | 5/5 | 5/5 | 5/5 | 5/5 |

Cells show on-time successes per request. Chromium 141's ten loaded timeouts remained in `starting` with no native callback through the extra 12 seconds. Its quiet native callbacks took 93–115 ms, and Typed callbacks took 101–113 ms. On Chrome 158 the loaded callbacks took 148–168 ms and 143–185 ms respectively. Explicit stop tests registration wake-up; they do not measure natural idle eviction. [Stopped-worker records](cold-start/stopped.jsonl)

## Worker and debugger controls

Twelve additional fresh Chromium 141 profiles ran under the same four-thread load. Half used the standard Playwright worker attachment. Half filtered only `service_worker` out of its automatic target attachments using a version-pinned, in-memory diagnostic hook. The HTTP observer and CDP ServiceWorker domain remained enabled in both arms. For a timeout with no callback, the driver held load for 12 more seconds, stopped the four threads and watched the same request for another 10 seconds.

- Standard attachment, three Native and three Typed. All six timed out. Playwright sent `Runtime.runIfWaitingForDebugger` immediately after attachment; Chromium acknowledged it only after load release. Then the worker evaluated, registered, entered the handler and returned a valid native response to the original send. Callbacks occurred **288–857 ms after load release**. All six client results remained `timeout`.
- Worker excluded, three Native and three Typed. All six timed out, the driver recorded no worker target attachments, and none produced a callback during the extra quiet window. Excluding the target did not correct startup in the CDP unpacked-loader configuration. This intervention alters driver behavior and cannot stand in for a regular user launch.
- Typed trial 3 illustrates the distinction between CDP command submission and execution. Relative to the native send, the host had already sent the resume command 390 ms earlier. The client settled at +5,003 ms, the load ended at +17,039 ms, the worker evaluated at +17,215 ms, registration finished at +17,316 ms, the handler ran at +17,330 ms and the native callback arrived at +17,335 ms. The worker-registration and handler times come from worker JavaScript; CDP acknowledged resume at +17,198 ms on the host. One send and one valid late callback were counted. [Per-trial clocks and attachment evidence](cold-start/driver.jsonl) · [Instrumentation](cold-start/attachment.cjs)

## Realistic exposure and CPU controls

The standalone arm launched the same Chromium 141 binary against a new profile using `--load-extension`. It had no debugger connection, Playwright driver, or CDP extension loader. The loopback startup page used a single fixed DOM trigger, and client and worker timestamps were collected over HTTP. This alternative changes the installation path as well as the driver, so it establishes whether the driver is *necessary* for the failure, rather than isolating each launch flag.

- With four competing threads, **4/4** first requests timed out (two per fixture). CPU load was stopped at two different elapsed times: approximately **8.1 s** and **23.1 s** after submission. In all four cases worker evaluation followed release and the original send received a valid callback **263–724 ms after release**. The client result remained a timeout. Repeating the effect at deliberately different release times and without a debugger strengthens the causal attribution to resource contention.
- With no injected load, three requests returned on time. One additional Native profile reached worker evaluation and registration but supplied no client telemetry within 45 seconds. It is an inconclusive startup-page/collection attempt: neither a successful send nor a five-second transport timeout was observed. It remains in the denominator of eight attempted standalone profiles. [Standalone records](cold-start/standalone.jsonl) · [Launcher](cold-start/standalone.cjs)
- In eight further first-install attempts on Chromium 141 with the original Playwright loader, two or three busy threads replaced the four-thread treatment (two profiles per fixture and thread count). **8/8** succeeded, with submission-to-settlement times of **290–4,005 ms**. Four competing loops on four logical processors represent sustained saturation rather than ordinary idle use. Parallel builds and browser jobs are a plausible exposure on comparable hardware. These small samples do not establish a portable safe utilization or thread threshold. [Headroom records](cold-start/headroom.jsonl)

## Preliminary load-before-activation control

Before the main matrix, a separate 88-profile series applied load before browser launch in both CPU arms. Chromium 141 missed the activation prerequisite in all ten gated CPU attempts (five Native, five Typed), with CDP still reporting `new/starting` after 45 seconds. No message was sent in those ten attempts. In the ungated traced arms both fixtures timed out in 5/5 CPU attempts and succeeded in 5/5 quiet attempts. Chrome 158 succeeded in all 40 traced trials. The eight plain trials included the same cold failure in Chromium 141 for both clients.

The initial collector used numeric lookup keys with string HTTP request IDs and retained zero worker HTTP markers. It also inspected the wrong nested field for the Typed raw response flag. Its client settlement, callback counts and CDP lifecycle observations remain usable. The main series corrected both diagnostic errors. All 60 on-time traced controls yielded worker milestones and valid responses. [Preliminary raw data](cold-start/trials.jsonl)

## Integration decision and remaining uncertainty

**CONDITIONAL** on accepting the [ADR's bounded local deadline and unknown remote outcome](ADR-001.md) for saturated Chromium 141. Keep the contention reproduction visible alongside the normal regression suite. Run timing-sensitive baseline checks with CPU headroom and retain a separately labeled stress run. Treat a timeout as an unknown outcome for side effects. Do not transparently replay the message. If on-time first delivery under sustained saturation is a product requirement for Chromium 141, this candidate cannot meet that requirement on the evidence here.

A worker startup delay is sufficient in fresh-install and stopped cases. Registration timing alone cannot explain the already-activated cases. The native comparison, controlled CPU dose, load removal at different times, runtime-local markers and standalone reproduction distinguish this from a DevEx bootstrap or dispatcher defect. They do not distinguish a browser task-queue policy from OS scheduling, or establish a cutoff for all versions, operating systems or CPU configurations. Only two browser builds on one Windows 10 host were measured. Memory was observed, not manipulated. A headed user session, Windows 11, Web Store install, natural idle, and the frequency of sustained contention in the field remain unmeasured. For a deeper upstream diagnosis, profile browser and renderer scheduling on a second comparable Windows machine with the same native fixture. No change to DevEx or timeout policy is justified by these measurements.

## Regression and Git evidence

| Existing local check | Result |
|---|---|
| Installed strict TypeScript, ESM resolution and negative controls | Exit 0; removing the 14 expected-error directives produced exit 2 at the expected lines |
| Packaged callback transport unit suite | Exit 0 |
| Existing full Chromium 141 MV3 messaging matrix, ordinary conditions | Exit 0 |
| Existing full Chrome 158 MV3 messaging matrix, ordinary conditions | Exit 0 |

The existing browser matrix checked sender authorization, stale document rejection with zero hits in the replacement document and one send, explicit frame targeting, eight-per-sender and 64-global admission, disposal/reopen, local timeout/abort settlement and worker restart without replay. The diagnostic collectors completed with exit 0, including the explicitly recorded standalone setup failure. The final Git diff from #16 is confined to this report and its lab directory. The production runtime tree hash is `c2cae2930cef9abe707d4c8eb928da7e120b6e2f`, identical to the baseline. Package version, permissions, public API and release workflows retain their baseline contents.

Evidence commit: `f29f2278402aefe6ab02426b5284631ee58265d1`. The final documentation commit is identified exactly by `git log -1 --format=%H -- reports/devex-025/STAGE_2B_2D.md` on this branch; its full SHA is also recorded in the draft PR and handoff. [Draft PR #17](https://github.com/Kiril-Hr/extension-2.0/pull/17) · [GitHub checks](https://github.com/Kiril-Hr/extension-2.0/pull/17/checks)

## Reproduction

Use an independent consumer produced by `node tests/verify-runtime.cjs` from this branch with `DEVEX_SOURCE_ROOT=packages/runtime`. Select its `run-*/examples/minimal` directory and verify the tarball hash against its candidate provenance record. Provide Playwright 1.56.1 and Chromium revision 1194 as in the candidate CI configuration. Use fresh output paths; the experiment refuses to overwrite earlier trial records.

```powershell
$env:DEVEX_PLAYWRIGHT_PATH = (Resolve-Path '.verification/tools/node_modules/playwright').Path
$env:PLAYWRIGHT_BROWSERS_PATH = (Resolve-Path '.verification/browser-binaries').Path
$env:DEVEX_CHROME_158 = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$lab = 'reports/devex-025/cold-start'
node "$lab/experiment.cjs" $consumer matrix-new.jsonl
node "$lab/experiment.cjs" $consumer startup-load-new.jsonl --load-before-activation
node "$lab/experiment.cjs" $consumer driver-new.jsonl --driver-control
node "$lab/experiment.cjs" $consumer standalone-new.jsonl --standalone
node "$lab/experiment.cjs" $consumer stopped-new.jsonl --stopped-control
node "$lab/experiment.cjs" $consumer headroom-new.jsonl --headroom-control
node "$lab/summarize.cjs" matrix-new.jsonl
node --expose-gc reports/devex-025/verification/installed.cjs $consumer
node tests/messaging-transport.cjs $consumer
node reports/devex-025/verification/browser.cjs $consumer 141.0.7390.37
$env:DEVEX_CHROMIUM_PATH = $env:DEVEX_CHROME_158
node reports/devex-025/verification/browser.cjs $consumer 158.0.8127.36
```

The lab records individual timeouts as experimental outcomes and continues collecting the other cells. A zero collector exit code alone does not certify message delivery. The matrix above counts client outcomes. The stored pilot predates the collector fixes described above. Rerunning its mode now includes those fixes.
