# DEVEX-025 · Stage 2B.P · Messaging performance and resource audit

Baseline is PR #13 at `6d913c305ca261d31b61df51b5a4cdd3f03bf01b`. The audit branch contains documentation only.

## Five findings

1. **Receiver capacity can stay exhausted indefinitely.** Eight admitted calls from one content document can hold all its slots. The receiver releases counts only when the handler settles. Client timeout, abort, binding removal and endpoint disposal leave running work in place. The mock reproduced `busy` after client timeouts and after reopening the endpoint. Resolving the original handlers restored admission.
2. **Validation is the main measured cost.** A successful echo runs four schema parses and eight JSON walks across both sides. Dense arrays take more work than a single string at the same encoded size. Bidirectional validation, sender authorization and exact document addressing justify the added work. Reducing duplicate passes requires preserving those guarantees.
3. **Normal client cleanup works.** Disposal cleared all 64 timers and abort listeners in the held-callback test. The mock still held 64 native-side callbacks until explicitly released. The client pending set limits unsettled local promises, while callbacks owned by Chrome may outlive local settlement. Their real lifetime and retained heap remain unmeasured.
4. **Byte limits apply after some allocations.** Key enumeration materializes every own key of each visited object before the visitor can stop on its byte budget. Chrome may already have deserialized the incoming message by then. A 64 KiB accepted body is a wire-size limit with no direct heap equivalence.
5. **Listener ownership is constant per realm.** A versioned global symbol shares the registry among bundles in the same realm. The first endpoint adds the listener and the last removes it. Restart creates a new realm. The app must synchronously re-register, and the old realm's in-flight work can be lost. There is no replay.

## Complexity and allocations

Let `N` be visited fields and values, `B` the bytes examined or encoded, `D` depth, `H` registered handlers in a batch, and `P` local unsettled requests. Map/Set costs below are expected or amortized. Schema cost and application work are separate.

| Path | Complexity and allocation |
|---|---|
| Dispatch | Expected O(1) route, spec, handler and count lookups, plus O(K) envelope key enumeration, ACL scan over the configured role list and validation. A valid envelope has fixed K. An invalid envelope with many own keys still allocates a key array. Admission allocates normalized sender, sender-key string for content, reply/execute closures and an async continuation. |
| Sender verification | Setup builds the origin set and parses each configured URL, O(total origin text). Each message parses one browser-supplied URL and compares origin/path strings, O(URL and compared string length), with expected O(1) set lookup. No per-sender cache grows with visits. |
| JSON validation | O(N+B) for a valid JSON tree with ordinary objects. Shared subobjects are charged for each serialized occurrence. For rejected inputs, account for the full own-key count of every visited container even when traversal stops early. Stack and ancestor set use O(D), with live key arrays along the active path, temporary property descriptors, escaped strings and UTF-8 buffers. Each `parse` walks input and output, plus the schema's time and allocations. No intrinsic quadratic scan found in ordinary dispatch or validation. |
| Registration | O(H) time and auxiliary space for atomic batch preflight and commit. The batch disposer scans O(H). Endpoint disposal clears its map and drops the route. Reclamation is proportional to released state over time. A retained disposer keeps the batch and handler references reachable, even after unregistering. |
| Outgoing tracking | Expected O(1) admission and settlement bookkeeping, O(P) retained promises, callback state, timers and optional signal listeners. One random ID allocates typed array, mapped strings and their join. Disposal walks O(P) with one deletion per entry. Timeout/abort do not cancel the transport's callback. |
| Incoming tracking | O(active sender buckets + outstanding executions), with O(1) count updates. Counts release in `finally`. A long-lived async continuation can hold the reply and request context while it remains reachable. Multiple protocol endpoints and clients can increase registered or outstanding state. |
| Type contract | Mapped unions and type helpers erase at runtime. `request` and `event` shallow-copy definitions once. Protocol initialization copies definitions and role arrays, proportional to the declared entries and roles. |

Implementation references: [dispatcher](../../packages/runtime/src/messaging/dispatcher.ts), [client](../../packages/runtime/src/messaging/client.ts), [sender](../../packages/runtime/src/messaging/sender.ts), [wire](../../packages/runtime/src/messaging/wire.ts), [contract](../../packages/runtime/src/messaging/contract.ts).

## Resource defaults

- **65,536 bytes** per accepted payload, success value or domain error. The envelope and intermediate schema values also allocate. For a single maximum-sized string, quotes and field syntax count toward the cap. At 64 accepted bodies there can be **4 MiB of encoded request-body volume** in flight. The per-sender equivalent is **512 KiB**. One equally sized response per request adds another 4 MiB of logical volume if both sets coexist. These are arithmetic examples. JS object layout, strings, clones, native buffers and callbacks are additional and depend on workload.
- **Depth 16** beneath root depth 0 checks recursion. It leaves width unrestricted except by serialized bytes, and only after enumeration. Overrides allow depth up to 128.
- **8 per sender, 64 pending.** The receiver counts across protocols, comparing against the admitting endpoint's budgets. Across mixed overrides, the largest configured limit can admit more than another protocol's limit. Content identity includes the document, so new documents use new buckets. Each client also has its own 64-waiter default. Multiple clients and callbacks lingering after settlement prevent that from being a realm-wide sender-side cap.
- **5,000 ms** is the default client wait. The timer is installed after synchronous outbound validation. It can't preempt validation, browser scheduling or handler work. Slow schemas, validators that allocate large output and long-lived handlers need separate application budgets.

## Mock experiments

Windows x64, Intel Core i3-7020U at 2.30 GHz, Node 24.18.0. Strict-compiled the pinned source in the audit worktree using the existing TypeScript 5.1.6 installation. The echo handler and shape guard do minimal work. A callback mock passes values by reference or simulates one `JSON.stringify` + `JSON.parse` per direction. Raw mock uses the same two JSON clones with a body-only callback echo. Typed mocks include the real envelope, dispatch and validation. No real Chrome IPC or MV3 scheduling. Timing uses median of five batches, 600 operations per batch after 100 warmups for text. The dense-array timing uses 150 operations per batch after 100 warmups. A separate five-operation probe provided a sensitivity check. The machine was shared with other Node processes. Compare orders of magnitude and avoid subtracting samples to derive component costs.

| JSON body | One JSON walk µs | Schema + two walks µs | One JSON clone µs | Raw JSON echo µs | Typed reference echo µs | Typed JSON echo µs | Typed JSON req/s |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1,024 B text | 15.35 | 30.02 | 6.00 | 11.89 | 148.03 | 178.51 | 5,602 |
| 16,384 B text | 137.00 | 221.37 | 63.16 | 113.60 | 1,031.52 | 1,125.26 | 889 |
| 65,536 B text | 418.76 | 886.25 | 263.88 | 579.27 | 4,008.05 | 3,597.25 | 278 |
| 64,011 B, array of 16,000 integers | 11,135.12 | 22,143.52 | 871.89 | 1,700.10 | 90,256.22 | 92,219.30 | 11 |

Throughput is the reciprocal of median sequential echo time. The 64 KiB reference run measured slower than the JSON run, an indication of timing variability. The dense-array comparison isolates a shape worth profiling further. The short array probe measured 71.12 ms per typed JSON echo. These measurements characterize shape cost at one size and do not estimate the scaling exponent.

A separate process ran four batches of 500 sequential 64 KiB text echoes. Two forced GCs surrounded an event-loop turn at each sample. Process heap used in MiB, from startup through the four batches, was **4.39 → 4.98 → 5.05 → 5.05 → 5.06**. Post-GC RSS rose from **39.56 to 66.29 MiB**. External memory rose from **1.92 to 2.09 MiB** and held through the remaining batches. Heap growth flattened in this finite sample. After the timing runs, a separate warmed sequence of 8,000 further echoes in four batches showed post-GC heap of 5.14 → 5.23 → 5.23 → 5.25 → 5.25 MiB and RSS of 176.71 → 177.30 MiB from its warm baseline to its final sample. Peak allocation and MV3 resident memory were outside the measurement.

With 64 pending sends on one signal and callbacks held by the mock, timers and abort listeners each went **64 → 0** on client disposal. All promises settled as `aborted`. Late callbacks were then delivered and ignored. Eight receiver handlers sharing an unresolved promise held their sender slots after client deadlines and through endpoint disposal/reopen. Resolving the promise released capacity. Final Chrome listener count was **0**. After these controls and GC, process heap used was **5.09 MiB**.

Local scratch scripts can be rerun from the audit worktree with `node --expose-gc .verification/performance/bench.cjs`, `node --expose-gc .verification/performance/array-probe.cjs` and `node --expose-gc .verification/performance/cleanup.cjs`. They use the untracked strict build in the same scratch directory.

## Comparison

Native Chrome one-shot messaging performs routing and JSON serialization, with explicit document or frame addressing available. The raw mock echo isolates two JSON round-trips through stringify/parse, one per direction. Native IPC, real MV3 scheduling and the application's native-side validation would add their own costs. DevEx adds the typed protocol, ACL, size/depth checks, budgets, lifecycle methods and structured failures above that transport.

The existing Stage 2A spike exercised native calls and pinned `@webext-core/messaging@4.0.2` in Chromium 141 and Chrome 158. Both re-registered and served a message after controlled worker restart. Native document addressing rejected delivery to a stale document. The library's frame target delivered to the replacement document. The spike measured behavior. Comparative CPU, throughput and heap numbers for the library are unavailable. [Stage 2A evidence](STAGE_2A.md)

## Recommendations

| Priority | Change | Evidence | Estimated effort |
|---|---|---|---|
| High | Define a cooperative receiver deadline and cancellation contract for application handlers. Keep accounting for ongoing work until it settles, or bound abandoned work separately. Include notifications and endpoint reopen in the regression test. | Reproduced capacity starvation after timeout and disposal. Releasing slots blindly would admit additional work while old work continues. | Medium. Requires handler lifecycle design and MV3 coverage. |
| Medium | Profile real validator shapes and reduce duplicate JSON walks only where a trusted validator contract supports it. Preserve input/output validation across the trust boundary. | Measured on text and dense arrays. | Medium. A guarded identity-preserving fast path or one-pass accounting requires correctness tests for transformation, mutation, escaping and byte limits. |
| Medium | Evaluate width and envelope-key admission limits against wide, rejected input. Document that native deserialization precedes application validation. | Static allocation path. Browser memory impact unmeasured. | Small–medium. Test rejection and compatibility with existing payload shapes. |
| Medium | Measure real Chrome callback lifetime after abort/timeout and on tab/worker teardown. If callbacks retain significant state, clear mutable references at local settlement so late callbacks hold minimal state. | Mock held callbacks by design. Real retention duration remains unknown. | Small for client refactoring, medium with browser verification. |
| Low | Add resource counters to the real-browser stress experiment and cover duplicate bundles, natural idle and worker restart. Document disposer ownership and drop references after use. | Single-realm cleanup reproduced in mock. Restart evidence belongs to the feasibility spike. | Small–medium. |

Heap behavior, IPC cost, worker wakes, real callback release timing and peak memory under concurrent MV3 workloads still need browser measurements.
