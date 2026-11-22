# DEVEX-020 · Design approval gate

**Outcome:** seven design documents on a dedicated branch based on verified main 06adb72. The behavior probes used published devxtension@1.1.0, including the production-bundled method lookup recorded in the executor RFC. New APIs, performance estimates and candidate acceptance tests below are design work. Implementation and release require separate decisions.

| Mechanism | Confirmed behavior and problem | Proposed contract and tradeoff | Complexity / compatibility risk | Test and decision |
| --- | --- | --- | --- | --- |
| Feature ownership | DisableFeatures replaces a shared prototype method; false leaves it disabled. | Controller-local registry with declared module IDs/keys. Activation and controller address the same store. An ambient singleton cannot separate callers. | Medium. Scoped controls are additive; retiring the legacy mutator would be breaking. | Two factories, two modules, one receiver; toggle/re-enter/dispose. Approve explicit IDs, error on unknown keys, policy lifetime and phased deprecation. |
| Declarative @Feature | Metadata alone has no dispatch guard. | Opt-in invocation-time guard with explicit ctx and void command. One stable wrapper; a per-instance wrapper/proxy still needs owner information. Time of call determines policy. | Medium. Changes function identity at decoration only for opt-in; arbitrary return/async methods require an explicit guard. | Check type rejection, inherited implementations, bound references and in-flight work. Approve explicit argument and void-only first release. |
| Resource ownership | Core cleans registered participants; Review manually owns its observer/click callback. | One scope per opted-in activation, synchronous LIFO cleanup and abort signal. Existing last-owner release for widget-wide resources. A global stack confuses concurrent owners. | Medium. Keep old hook order and argument count for old modules. | Two owners, setup failure, disposer failure, late completion, real DOM after exit. Approve scope boundaries and error policy. |
| Callback control | Factory autostarts; ordinary external callbacks own their listeners. | Same controller executes configure immediately and owns returned final cleanup. A pre-start queue changes the public ordering contract. | Low–medium. Fail-closed callback errors dispose the live instance. | Identity, deduplication, reentrancy, teardown and replacement. Approve error handling and synchronous contract. |
| Executors | Legacy pairs checked provenance by metadata; current class shorthand can invoke every prototype method. | Typed constructor-plus-key descriptor, checked registration and bound receiver. Keep arrays and deprecate broad shorthand; metadata traversal adds false confidence. | Medium. Removing the shorthand now would break consumers. | Verify bad owner/key, inherited override, receiver, helpers never executed and legacy order. Approve selector and migration window. |
| Rules | Meet combines server rules, thresholds, people and DOM effects. Review has no equivalent dependency. | Retain feature-local typed predicates; consider an independent library when multiple consumers demonstrate shared semantics. A Core engine would encode an unverified contract. | No runtime change or migration. | Consumer-level table tests for missing rules, thresholds and effects if pursued. Deferral accepted. |

### Approval requested

The author accepted the directions in this table with amendments. Review the concrete signatures and incompatibilities below before implementation. Lifecycle activation is a prerequisite for the recommended scoped guard. The legacy-mutator decision is especially important: a compatible 1.x release can guarantee reversibility for the new path, while removing irreversible behavior from every public path requires a migration decision.

[Source review and evidence](ARCHITECTURE_REVIEW.md) · [Features and decorator alternatives](FEATURE_MANAGER_RFC.md) · [Resource ownership](LIFECYCLE_RFC.md) · [Post-start control](CONTROLLER_API_RFC.md) · [Executors](EXECUTOR_CONTRACT_RFC.md) · [Implementation and verification gates](IMPLEMENTATION_PLAN.md)

## Combined consumer example

**Design contract for a future candidate.** All framework symbols below would come from its public npm entry. Activation, executorOf, the decorator overload, featureScope, activation option, controller.features and .control are proposed. This example is a design fixture, not an executable example for published 1.1.0. The page contains #review-queue with two li elements.

```ts
// modules/reviewModule/reviewModule.ts — shown together for this example
import { Feature, ModuleDecorator, ServiceDecorator, executorOf } from 'devxtension'
import type { Activation } from 'devxtension'

type ReviewActivation = Activation<'review'>

@ServiceDecorator
class ReviewService {
  run(ctx: ReviewActivation): void {
    const queue = document.querySelector('#review-queue')
    if (!queue) return

    const status = document.createElement('output')
    const refresh = () => { status.textContent = String(queue.childElementCount) }
    ctx.onCleanup(() => status.remove())
    document.body.append(status)
    refresh()

    const observer = new MutationObserver(refresh)
    ctx.onCleanup(() => observer.disconnect())
    observer.observe(queue, { childList: true })
  }

  attachButton(ctx: ReviewActivation): void {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Review next'
    button.dataset.reviewAction = ''
    ctx.onCleanup(() => button.remove())
    button.addEventListener('click', () => this.complete(ctx), { signal: ctx.signal })
    document.body.append(button)
  }

  @Feature('review', { scope: 'argument' })
  complete(ctx: ReviewActivation): void {
    document.querySelector('#review-queue')?.firstElementChild?.remove()
  }
}

@ModuleDecorator({
  url: 'https://example.com/review/*',
  featureScope: { id: 'ReviewModule', keys: ['review'] },
  vanilla: {
    activation: true,
    mainService: ReviewService,
    executors: [executorOf(ReviewService, 'attachButton')]
  }
})
export class ReviewModule {}
```

```ts
// modules/index.ts
import { ReviewModule } from './reviewModule/reviewModule'

export const modules = [ReviewModule]
```

```ts
// runner.ts
import { createExtensionFactory } from 'devxtension'
import { modules } from './modules'

const config = {
  params: {
    manifest: {
      name: 'Review queue', version: '0.1.0', description: 'Review queued items',
      action: { default_title: 'Review queue' },
      host_permissions: ['https://example.com/*'], permissions: []
    }
  }
}

const first = createExtensionFactory(modules)(config).control(controller => {
  const review = controller.features.for('ReviewModule')
  const pause = () => review.disable('review')
  window.addEventListener('pause-review', pause)
  return () => window.removeEventListener('pause-review', pause)
})
```

**Two-owner acceptance scenario** (append to the runner in a candidate integration fixture only). Both calls must use separate curried factories: applying config twice to the same returned configure function replaces its previous cycle. Both resolve the same decorated ReviewService singleton in this JS realm. Its callbacks capture different activation arguments. The DOM queue is intentionally shared.

```ts
const second = createExtensionFactory(modules)(config)
const [a, b] = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-review-action]'))
const queue = document.querySelector('#review-queue')!

window.dispatchEvent(new Event('pause-review'))
console.assert(!first.features.for('ReviewModule').isEnabled('review'))
console.assert(second.features.for('ReviewModule').isEnabled('review'))
a.click()
console.assert(queue.childElementCount === 2)
b.click()
console.assert(queue.childElementCount === 1)

first.features.for('ReviewModule').enable('review')
a.click()
console.assert(queue.childElementCount === 0)
first.teardown()
console.assert(!a.isConnected && b.isConnected)
second.teardown()
```

The assertions specify expected behavior and must become failing/passing test assertions against a future candidate. The actual AUTHOR-001 registry already composes a feature-local module with ReviewService, ReviewState and ReviewWidget. Its conventional [ReviewWidget] executor and manual cleanup work with 1.1.0. The example here keeps the registry and composition root, but uses a chosen method for activation-specific UI, passes ctx explicitly and assigns observer/button cleanup to the caller. The actual consumer retains its shared completion counter; this smaller design fixture counts pending DOM items only. No change to AUTHOR-001 is required.

### Remaining incompatible contracts

- Full legacy prototype semantics and a blanket prohibition on prototype writes across every export cannot both hold in 1.x. Preserve legacy behavior in isolation, reject mixed guarded/legacy targets before mutation, and prohibit runtime prototype mutation on the new path. Any removal requires separately approved migration.
- TypeScript accepts value-returning functions as void callbacks in common assignments. The decorator and selector must validate exact return types using declaration fixtures; a blanket void callback type is insufficient. TypeScript also cannot guarantee a valid live activation, DI identity or owner from structural typing. Runtime validation remains necessary.
- Dynamic string module IDs and cross-file decorator metadata do not automatically infer a global literal union. Local typed key unions plus runtime declaration validation are the proposed minimum. Automatic inference is a candidate experiment.
- Post-start control cannot configure the first synchronous setup retroactively. Disabling only gates subsequent calls. Code needing a different first-run policy would require a separate pre-start configuration decision.
- Core rule engine deferred. Approval requested for these concrete examples and migration boundaries before implementation.
