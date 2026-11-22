# RFC · Post-start control callbacks

The [factory](../../devxtension/src/core/createExtensionFactory.ts) starts participants during configuration and returns a live controller. The [existing lifecycle tests](../../tests/factory-lifecycle.cjs) exercise replacement of a prior configuration, repeated setup and teardown. A consumer can already pass that controller to an ordinary function, but must retain and release any listeners the function adds. Adopt the post-start model explored in DEVEX-018.

```ts
interface ExtensionController extends ExtensionLifecycle {
  readonly features: FeatureRegistry
  control(configure: (controller: ExtensionController) => void | (() => void)): ExtensionController
}

const controller = createExtensionFactory(modules)(config).control(controller => {
  const stopRecording = () => controller.features.for('GoogleMeetModule').disable('recording')
  window.addEventListener('recording:off', stopRecording)
  return () => window.removeEventListener('recording:off', stopRecording)
})
```

**Contract proposed for approval.** Keep the old ExtensionLifecycle type and curried call. Extend only the inferred factory result. The features member depends on approval of its own RFC. Configure runs synchronously once on registration after successful autostart, receives the existing object and returns to the caller before chaining continues. Return the identical controller. Initial setup cannot be observed this way. First-run feature overrides, if later required, belong in an explicit declarative option, not in .control().

Deduplicate by callback reference within the current factory instance, including reentrant registration of the same reference (mark before invocation). Distinct closures register independently. Record valid returned cleanups as callbacks finish. reSetup neither releases nor replays them. Replacing the configuration or final teardown marks the controller disposed, detaches built-in route/message listeners, drains control cleanups LIFO, then tears down routes and globals. All phases must run despite errors; control cleanup cannot reactivate a closing controller. Repeated teardown is inert. Calling control after disposal throws. A callback may synchronously call teardown; immediately invoke any subsequently returned cleanup.

Fail closed on a thrown configuration error or invalid return, including thenables: tear down this instance to prevent an autostarted extension being orphaned by an interrupted chain. Preserve the configuration error first and aggregate teardown failures. Type and document callbacks as synchronous; runtime rejection cannot cancel work an async callback has started. A callback that acquires resources and throws before returning its disposer must roll back those partial acquisitions itself. Storing this callback as a future startup event would change ordering and replay side effects. A separate controller class would duplicate ownership. Manual external composition remains compatible.

Test controller identity, ignored return from old calls, timing relative to startup, callback deduplication, distinct closures, cleanup order, error paths, nested registration, reSetup, reconfiguration and registration after disposal. Browser acceptance: repeated SPA navigation yields one control listener invocation per user event and none after teardown.
