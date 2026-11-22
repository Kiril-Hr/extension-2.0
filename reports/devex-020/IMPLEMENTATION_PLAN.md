# Implementation gates

The next action is author review of the four RFCs and the rule-composition disposition. No phase below has started. Each increment requires approval of its contract and its own evidence before the next dependency is introduced.

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
