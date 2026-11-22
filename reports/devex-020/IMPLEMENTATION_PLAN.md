# Implementation gates

The author accepted the architectural direction and deferred the Core rule engine. The next gate is review of the amended public example and compatibility boundaries. No phase below has started. Each increment requires approval of its contract and its own evidence before the next dependency is introduced.

| Order | Change after approval | Exit evidence |
| --- | --- | --- |
| 1 | Freeze the two compatibility lanes. Pin 1.1.0 from the registry in the existing independent consumer. Put candidate tests in a separate temporary consumer. Record the existing irreversible legacy behavior as characterization. | Check resolution, lockfile source, manifest, browser UI, and the unchanged factory API. No candidate imports in AUTHOR-001. |
| 2 | Introduce opt-in route CleanupScope and activation dispatch using Core's current setup/teardown path. Preserve existing ownership counters. | Red-to-green tests for rollback, two simultaneous owners, LIFO, disposal errors, expired scopes, late registration/async work and repeated setup. Keep legacy tests green. |
| 3 | Add per-controller registry and typed, scoped command guard. Extend the activation from step 2. Define the legacy isolation boundary before enabling any new decorator overload. | Run the Feature RFC matrix, command-return compile failures and two simultaneous factories sharing a DI receiver. Demonstrate reversible toggles without method replacement. |
| 4 | Add explicit executor selection with DI identity and preflight validation. | Strict positive/negative installed declaration fixtures, binding/order/rollback, production property-name test and both legacy forms. |
| 5 | Add synchronous post-start .control() and compose its final cleanup with the existing controller. | Old structural ExtensionLifecycle assignments compile. Browser and unit tests cover nested callbacks, errors, disposal during registration and startup ordering. |
| 6 | Document each approved contract, migration examples and the release boundary. Run full package and browser acceptance against the integrated candidate. | Distinguish candidate SHA/tarball hash from registry version. Record failures and unresolved decisions. Separate authorization for publication. |

### Verification procedure after implementation

From the candidate worktree run npm ci inside devxtension, then node tests/factory-product.cjs, tests/packaging-cleanup.cjs, tests/factory-watch.cjs and tests/factory-browser.cjs in the order and Windows environment specified in [verify.yml](../../.github/workflows/verify.yml). Run the documented public minimal-example build and tests/minimal-example-browser.cjs as well. factory-product covers clean production build, tsc --noEmit, regression, React, DI, Manifest conversion, pack and independent Webpack installation. Preserve exit codes.

In a clean copy of the independent consumer, install the freshly packed candidate tarball, verify resolved package bytes and hash, typecheck and build the original Review source. Run its real Chromium widget, route exit/re-entry and detached-handler tests. Run a *separate* opt-in source fixture against that same tarball for new decorators/scopes/control. Use the old prototype characterization only on the documented legacy lane; the candidate guard tests require enable to restore dispatch. Repeat browser tests from fresh profiles and with repeated navigation. Verify no residual observer, event listener, timer, subscription, delayed mount or control callback after final release. No npm publish, workflow edit or PR #2 operation is necessary.

If an increment cannot preserve the promised compatibility, stop that increment and present the smallest versioned migration. Do not transfer application rules to Core to make an acceptance test pass.

## Amended approval checklist

1. Review the public imports and full example in [FINAL_REPORT.md](FINAL_REPORT.md#combined-consumer-example). Confirm the second @Feature argument, first-argument activation, declared ID/key shape and return contract. Preserve metadata-only decorators as well as the legacy wrapper for 1.x.
2. Require a type-only candidate fixture for the example and negative fixtures for wrong keys, missing ctx, value/Promise-returning commands, accessors and bad executor selection. Explicitly record which errors require runtime validation.
3. Run two independent factory invocations in the same JS realm against one DI receiver. Disable one factory's command, issue both callbacks, change route, call an expired handle, and dispose one controller. Assert the other policy and owner resources remain live. Test that pending async work continues until the owning activation cancels it.
4. Build the integrated fixture with the real CLI from the *candidate tarball*. Invoke the typed selector in Chromium, verify the receiver, and ensure its sibling helper did not run. Repeat the unchanged published-package smoke in a separate consumer. Current production-bundle evidence is scoped in the executor RFC.
5. Record the deferred Core Rule Engine decision. Keep release propagation in PR #2, outside this branch. Stop for signature and migration sign-off before any implementation.
