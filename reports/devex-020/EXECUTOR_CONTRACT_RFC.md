# RFC · Explicit executor selection

[Historical provider](../../example/src/core/providers/moduleProvider.ts) read the method's classname metadata, compared it to declared services and recursively inspected derivative services, then bound the method to the nominated object. This expressed a real ownership requirement. String equality does not establish constructor identity; recursive discovery also depends on object shape. [Current normalization](../../devxtension/src/core/commonUtils/checkModuleDecoratorParams.utils.ts) and [binding](../../devxtension/src/core/providers/ModuleProvider.ts) offer two contracts:

- `executors: [ServiceA, ServiceB]` resolves the registered instances, selects each executor method, and invokes them in array order after main/widget setup. This is what Review uses.
- `executors: ServiceA` enumerates own prototype property names, reads each value and schedules every function except constructor. Unrelated helpers can run; reading an accessor can itself have side effects. Inherited methods are absent from that enumeration.

### Proposed additive selector

```ts
// New selector. Entries are evaluated as data at decorator evaluation.
vanilla: {
  activation: true,
  mainService: MeetService,
  executors: [
    executorOf(MediaService, 'attachControls'),
    executorOf(RecordingService, 'startRecording')
  ]
}
```

Use a generic helper to correlate a constructor's public instance type with an eligible method key before heterogeneous entries go into an array. It produces a descriptor, never a bound function or service instance. In a new list allow plain legacy classes alongside descriptors. A plain entry keeps its conventional zero-argument executor. A descriptor under activation:true receives the activation; permit zero-argument methods as well. Without the option select only methods callable without arguments. Stage validation at declaration and, where activation mode is needed, in the module option types. Demonstrate strict inference with compile fixtures before blessing the syntax.

Eligible signatures are synchronous public instance commands callable with zero arguments or the documented Activation parameter, returning void. Reject data fields, getters/setters, constructor/static members, missing keys, mandatory unrelated arguments and promise/value-returning commands. TypeScript structural types cannot reliably distinguish function-valued fields/getters from prototype methods. Runtime checks must complement types. For the first selector support prototype data methods (including inherited methods/overrides); exclude arrow-function fields explicitly. A method name is portable through compilation only if the build preserves selected property names; verify production Webpack output.

At setup resolve the already registered singleton and verify its registration corresponds to the exact supplied constructor, using registration identity maintained by DI. Reject a different class with the same name, even when its implementation looks identical. A helper must never auto-register an unknown class. Walk descriptors without invoking getters; reject an own field shadowing the selected prototype method. Call the method with the actual singleton as receiver. Preserve array order and explicit duplicates. Fail on invalid selection with module ID/name, constructor and key. Validate all selections before the first executor side effect; if setup has already begun, use ordinary rollback. Check runtime arguments by contract and types, not Function.length.

### Compatibility and choice

For 1.x retain both existing input forms and their invocation semantics. Deprecate broad single-class scanning with a migration example: inventory intended methods, list them in order with executorOf, or use [Service] for just executor. Removing enumeration requires an approved breaking version. Raw function references need additional ownership proof and break on bind/wrapping; an unconstrained string tuple loses inference. A selector callback can execute arbitrary code and does not demonstrate which method was selected. DI identity plus a checked key is sufficient.

Test with two classes sharing a method name, unregistered and colliding constructors, inherited/overridden methods, accessors with observable side effects, missing methods, unrelated helpers, receiver-dependent state, preserved order and duplicates. Run existing single-class and class-array fixtures unchanged. Typecheck both activation modes and invalid selections against the installed candidate declarations.

## Production bundling evidence and remaining gate

Executed a disposable independent consumer installed from registry devxtension@1.1.0. Added a decorated ProductionProbe with a receiver field, selectedCommand() reading that field, and otherCommand() throwing. The probe resolved the service from public DI, read a method key from the URL, checked it against 'selectedCommand', and called receiver[key].call(receiver). The real devex-scripts production build passed (Webpack 5.88.2). Chromium 141.0.7390.37 loaded the generated MV3 bundle, navigated with ?command=selectedCommand, and observed the exact receiver value in the DOM with zero page errors.

This demonstrates string-key lookup and receiver preservation with the existing production defaults. It does not execute the proposed executorOf helper or prove behavior under arbitrary property mangling. Accept typed selection/DI identity checking; retain both existing forms. Candidate acceptance requires repeating this experiment with the real selector, negative ownership tests and a sibling helper that would fail if invoked. A consumer with custom property mangling must reserve selected keys or receive a diagnostic. Do not reinstate recursive verifyMethod().
