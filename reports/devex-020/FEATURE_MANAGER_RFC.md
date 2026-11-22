# RFC · Reversible feature controls

**Decision requested.** Store policy per factory instance and declared module ID. Pass the activation explicitly at invocation when a service can be shared. Keep @Feature('recording') as metadata for legacy code. Opt in to a guard with a second decorator argument.

```ts
// Proposed module option, configured beside vanilla in @ModuleDecorator
featureScope: { id: 'GoogleMeetModule', keys: ['recording'] }

// Proposed consumer method
@ServiceDecorator
class RecordingService {
  @Feature('recording', { scope: 'argument' })
  startRecording(ctx: Activation): void {
    // Start the consumer-owned operation.
  }
}

// Within an opted-in activation
service.startRecording(ctx)
ctx.features.disable('recording')
ctx.features.enable('recording')
ctx.features.isEnabled('recording')

// From the controller returned by the factory
controller.features.for('GoogleMeetModule').disable('recording')
```

### Ownership and resolution

Core constructs one registry as a dependency of its factory/controller and injects a narrowed feature handle in the activation passed to opted-in main services. The service instance still comes from public DI. Its context argument carries the factory-specific dependency even when another factory resolves the same service object. Avoid registering the registry under a process-wide DI string key. The global controller validates all module declarations at configuration time, including inactive routes. Duplicate IDs within one factory, duplicate keys within one declaration, empty and unknown names fail with a diagnostic. The same string in two module IDs is independent. Initial flags are enabled, repeated writes of the same value are idempotent.

Module policy survives route exit/re-entry and reSetup. A route's activation handle expires on exit, even if its module ID becomes active again. The controller may configure inactive modules. Final teardown/replacing the factory configuration disposes its registry. Future calls on disposed handles throw. Separate factory instances, tabs and JS contexts have independent state. No persistence to storage proposed.

### Dispatch and return

Install one stable wrapper per opted-in prototype method at decoration; toggles update a flag, never rewrite the method. The wrapper validates that its first argument is a live Core-issued activation, checks the key in that activation, then calls the original with the same receiver and arguments. Passing another valid activation selects that owner's policy explicitly. This is an ownership convention, not a security boundary. A module-local callback can capture ctx for later calls; dispose or check its signal before running it. A missing or expired ctx is a programming error.

For the first increment support synchronous command methods explicitly returning void. Disabled calls return undefined without invoking the body. Enabled calls preserve side effects, exceptions and receiver. Require compile-time validation of the first parameter and actual return type through the typed decorator descriptor (ordinary assignment to a void callback accepts value-returning functions). Negative type fixtures for number, Promise and missing context must pass before shipping. Value-returning and async methods keep an explicit guard at entry until an async return contract is approved. Disabling affects subsequent invocations only. Promises, timers or recordings started earlier continue unless their owner explicitly cancels via lifecycle cleanup.

The original function object differs from the decorated wrapper. Method lookup and saved bound callbacks created after decoration retain the same wrapper across toggles. Inherited decorated implementations keep the guard. An override must opt in again. Reject fields, accessors and static targets for the new decorator. No stack-based owner inference across await.

| Mechanism | Tradeoffs |
| --- | --- |
| Invocation guard (preferred) | One wrapper frame and flag lookup per call, debuggable with explicit ctx. Stable dispatch across toggles, typed command restriction, shared receiver supported. |
| Per-instance replacement | Allocation per receiver, saved references can bypass later replacements, awkward with inherited methods; shared DI receiver still has two possible owners. |
| DI proxy | Traps on access, receiver and private-field hazards, changes identity/debugging and can miss internal calls. Widens compatibility surface to every consumer. |
| Explicit if in service | Transparent identity, supports arbitrary signatures, easiest for calculations and async. Repeated guards rely on every entry point checking policy. Keep as an alternative to decoration. |

### Migration boundary

1.1.0 users keep existing observable behavior. In a compatible candidate retain deprecated DisableFeatures for existing unguarded classes; warn/document that it mutates shared prototypes. Reject mixing the legacy mutator with opted-in guarded targets **before** any mutation. No new feature-manager path uses that mutation. A full guarantee across *all* exports requires retiring or changing the legacy helper in a separately approved major release. Replacing its implementation silently would break callers relying on persistent suppression outside its wrapper. Migrate a service by replacing its wrapper call with an explicit scoped update and guarded command. Rebuild/reload to start with clean prototypes. For the Meet controller returning result data, guard its nested void recording command, not the result-producing orchestration method.

Acceptance: two factories × two module IDs sharing a key, one DI receiver used by two owners, two receivers, repeated writes, inherited method, bound reference, original exceptions, invalid keys/contexts, pending operation and disposed handles. Compare a plain call and guarded call in a tight loop before considering optimization; no benchmark claim yet.
