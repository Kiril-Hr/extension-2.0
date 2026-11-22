# RFC · Activation-owned resources

**Proposed minimum.** Extend the vanilla declaration with an opt-in `activation: true`. Its main service accepts `run(ctx: Activation): void`. Legacy calls keep zero arguments. For this increment only opted-in main methods and explicit executors get ctx directly. A module service can pass ctx to a secondary service. No base class, ambient current owner or required change to existing Module/Widget signatures.

```ts
interface CleanupScope {
  readonly signal: AbortSignal
  onCleanup(release: () => void): void
}
interface Activation extends CleanupScope {
  readonly features: ScopedFeatures
}

run(ctx: Activation) {
  const observer = new MutationObserver(() => {
    if (!ctx.signal.aborted) this.refresh()
  })
  ctx.onCleanup(() => observer.disconnect())
  observer.observe(document.body, { subtree: true, childList: true })

  const timer = setInterval(() => this.refresh(), 1000)
  ctx.onCleanup(() => clearInterval(timer))
  window.addEventListener('resize', this.refresh, { signal: ctx.signal })
}
```

ScopedFeatures exposes enable/disable/isEnabled as defined in the Feature RFC; an undeclared key fails. Resource support can ship first with just CleanupScope. ctx is issued by the Core for each module activation before calling user setup. Register cleanup immediately when each acquisition succeeds and before the next operation that may throw. Register subscriptions as `() => sub.unsubscribe()`, and owned AbortControllers as `() => controller.abort()`. Bound functions or arrow callbacks remain the consumer's responsibility.

| Owner | Lifetime and release |
| --- | --- |
| Route module | New scope each setup generation. Its main and executors share this activation. Route change or final teardown closes it once. |
| Shared DI service invoked by A and B | Pass each caller's ctx as an argument. A's listener belongs to A. Store per-owner state keyed by activation if necessary. Overwriting an instance field with the latest ctx would lose ownership. |
| Singleton widget/manifest participant | Keep current first-acquire/last-release hooks. Instance-wide resources acquired in existing setup remain owned by its teardown. Route-specific registrations done by an executor use the route ctx. Never register singleton-wide cleanup against the first route. Extending shared setup signatures is deferred. |
| Controller callback | Final factory lifetime, independent of routes; see controller RFC. |

### Disposal algorithm

1. Mark scope closed and abort its signal before disposing user resources. This invalidates late continuations and reentrant teardown. Take the cleanup stack and clear stored references.
2. Invoke registrations in reverse order. Registrations made after closure run immediately once per registration. Two registrations of the same function are two acquisitions. Exceptions during a late registration propagate to its caller. Promise-returning cleanup is unsupported in the synchronous lifecycle.
3. Continue when any cleanup throws. Close the route scope before existing widget/React/module teardown, then attempt all existing hooks even on failure. Preserve established ordering among pre-existing hooks. Throw AggregateError for multiple failures, retaining original errors. Prefer the single original error when only one failed in the new scope.
4. On partial setup failure run this same close path for every opened scope and invoke existing Core rollback. If setup and disposal both fail, report setup first followed by cleanup errors. Construction at decorator evaluation is outside a route scope; constructors must avoid acquiring activation resources.
5. On reSetup never reuse a closed scope or signal. An async continuation must check signal.aborted after await and before side effects. For uncancellable acquisitions that complete late, register their disposer immediately; a closed scope invokes it at once. Cleanup cannot undo work already committed externally.

**Alternatives.** A base-class this.onCleanup would hide which caller owns a singleton operation. A global stack fails across concurrent factories and async continuations. Manual teardown remains appropriate for simple widgets such as ReviewWidget. The accepted direction adds one scope per activation and storage proportional to active registrations. Test two owners, two routes, partial setup after each acquisition, failing disposers, reentrant teardown, late registration and late completion. In Chromium observe actual observer, listener and timer behavior after exit and re-entry. Confirm legacy zero-argument calls and manual cleanup still execute exactly once.

## Author review disposition

Activation ownership, abort signal, LIFO within an activation, idempotent disposal and error aggregation are accepted. The caller passes ctx through an opted-in run or explicitly selected executor to the DI service on each invocation. A service may close over ctx for that activation's listener, never store a single mutable “current ctx” on a shared receiver. See the two-controller example in [the combined design](FINAL_REPORT.md#combined-consumer-example). Keep the current Core traversal order between modules. Reentrant registration during disposal follows the same immediate-release rule as late asynchronous completion. This guarantee starts when a disposer has been registered; consumer code owns rollback of earlier partial acquisitions.
