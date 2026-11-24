# DEVEX-025 · Stage 2B.3 · Receiver capacity investigation

PR #13 was open and Draft at `6d913c305ca261d31b61df51b5a4cdd3f03bf01b` when checked. Its file list and description cover Stage 2B.1. The remote branch list and PR search provided no completion evidence for Stage 2B.2. The investigation used a dedicated local worktree at the fixed SHA. [PR #13](https://github.com/Kiril-Hr/extension-2.0/pull/13)

## Reproduction and root cause

The [isolated fixture](receiver-capacity.cjs) drives the actual compiled client and dispatcher with controlled Chrome callbacks. It reads the realm registry for counters and injects sender metadata through the Chrome mock. The test uses eight parallel requests and short client timeouts to make the sequence repeatable.

| Checkpoint | Cumulative invocations | Receiver pending | Sender A / B | Result |
|---|---:|---:|---:|---|
| Eight A calls admitted | 8 | 8 | 8 / 0 | All await a deferred promise |
| All client requests timed out | 8 | 8 | 8 / 0 | Next A call returns `busy` |
| Endpoint disposed | 8 | 8 | 8 / 0 | Root listener count becomes zero |
| Endpoint reopened | 8 | 8 | 8 / 0 | Next A call still returns `busy` |
| B sends while A is saturated | 9 | 9 | 8 / 1 | B succeeds |
| Original deferred promise resolves | 9 | 0 | 0 / 0 | Eight obsolete replies report `aborted` |
| A sends again | 10 | 0 | 0 / 0 | A succeeds and releases its slot |

The client timeout deletes the outgoing waiter, clears its timer and drops its signal listener. Receiver accounting lives in a separate realm registry. Admission increments counters before invoking the handler. Only the handler's `finally` decrements them. Disposing an endpoint removes bindings and the listener when appropriate, while the registry survives. Reopening the endpoint consults the same counters. A promise that never settles can therefore keep its bucket saturated for the realm's lifetime. This is a liveness problem within the current hard concurrency bound. [Client settlement](../../packages/runtime/src/messaging/client.ts#L44) · [Receiver accounting](../../packages/runtime/src/messaging/dispatcher.ts#L67) · [Disposal](../../packages/runtime/src/messaging/dispatcher.ts#L129)

## Options

| Option | Guarantees and failure mode | ADR fit and estimated complexity |
|---|---|---|
| **A. Receiver deadline and AbortSignal** | Requests cooperative cancellation. Releases only after the handler's promise settles. A handler that ignores the signal still consumes capacity. Underlying work must also settle before the handler returns if that work is to remain counted. | Small as an application wrapper. Medium as a transport feature because it adds handler context, timer ownership, endpoint generation and response-race rules. A receiver-local policy can retain the ADR's client-only cancellation rule. |
| **B. Active and abandoned accounting** | Separate counters improve visibility. Hard sender and realm limits must cover their sum, which means abandoned work can still cause `busy`. A second reserved allowance requires an explicit finite combined ceiling and fairness rules. | Medium–high. Adds accounting states and transitions for limited benefit at this stage. No ADR change needed for observability alone. |
| **C. Hard admission and diagnostics** | Existing hard bounds and `busy` continue to limit concurrent work. Count active and overdue operations for diagnostics, without automatically evicting either. Recovery relies on application work settling or realm shutdown. | Small. Fully aligned with current admission and local-only cancellation semantics. Diagnostics cannot restore capacity alone. |

All options keep state in the receiver realm. An MV3 worker restart creates a new registry and requires synchronous re-registration. Old web requests or external side effects can have an unknown outcome. The next worker does not inherit counters or replay requests. Stage 2B.3 did not run a real worker restart. [Accepted ADR](ADR-001.md)

## Recommendation and API boundary

Use **A as an opt-in application wrapper with C's hard admission invariant**. Keep existing transport and wire contract. A receiver-local controller can pass a signal to an application handler, request cancellation on deadline or endpoint closure and clear its timer at settlement. The wrapper awaits the underlying handler. A `Promise.race` that settles the wrapper before the work settles would violate the admission invariant. An application's declared result or domain error stays the reply. The fixture declares a domain error for a handler that cooperatively stops at the deadline.

The PoC's application handler takes `{ payload, sender, signal: AbortSignal }`. Public DevEx `Handlers` remain unchanged in this investigation. A future first-class API needs an architecture decision covering a receiver-local deadline, signal ownership, response behavior on cooperative cancellation and handling for notifications. It must preserve client abort and timeout as local outcomes. A client-to-receiver cancellation message or an automatic transport-level timeout reply would be a separate contract decision.

## PoC checks and negative controls

- A handler finishing before the receiver deadline returned its successful value. The wrapper active set and registry returned to zero.
- A cooperative handler observed the deadline signal and returned its declared domain error. A second handler ignored the same signal, outlived its client timeout and kept one receiver slot.
- Client abort settled the client. The receiver still counted both outstanding operations. Closing the endpoint and invoking the wrapper's close method signalled the still-running handler. Both operations remained counted.
- Reopening allowed a new successful request while the old two slots stayed charged. Completing both old handlers produced only obsolete `aborted` replies. The final pending count, sender map, wrapper active set and listener count were zero.
- The ninth A request and the first A request after reopen produced `busy` without invoking any handler. B's concurrent request proved A's per-sender ceiling was the binding limit. As a mutation control, a disposable compiled dispatcher reset receiver counts after 5 ms while the eight original handlers were still running. The post-timeout accounting assertion failed with `0 !== 8`, exit 1.

Strict TypeScript 5.1.6 compilation of the pinned messaging entry exited 0. Node 24.18.0 on Windows passed five sequential fixture runs. These are Chrome-mock results.

```powershell
# Run from the audit worktree after npm ci in packages/runtime.
node packages/runtime/node_modules/typescript/bin/tsc --strict --skipLibCheck --target ES2020 --module commonjs --lib ESNext,DOM --typeRoots packages/runtime/node_modules/@types --types chrome --outDir .verification/tools/capacity packages/runtime/src/messaging/index.ts
node reports/devex-025/receiver-capacity.cjs .verification/tools/capacity
```

## Minimal implementation plan

1. Keep `pending` and sender counts tied to handler settlement and shared across endpoint generations. Preserve the current `busy` response at saturation.
2. Apply the wrapper to a handler whose work supports abort and whose returned promise covers all counted work. Select a receiver deadline as application policy. Wire wrapper close into the owner that disposes the endpoint.
3. Use bounded diagnostics for outstanding and overdue work. Record counts and elapsed time without payloads. Gate any public handler context or cancellation behavior change on architecture review.
4. Verify the adopted policy in real Chromium with a cooperative handler, an ignoring handler, endpoint reopen and worker restart. Include an admitted notification and an external side effect with an unknown outcome after restart.

Application wrapper and diagnostics are small changes. A public handler API and browser acceptance suite are medium. Blocking JavaScript can delay timers and cancellation handlers. Detached work or an uncooperative dependency can continue after abort. No proposal relies on forcibly terminating arbitrary JavaScript.
