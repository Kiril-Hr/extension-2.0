# Stage 2B.1 · Typed one-time messaging

The runtime candidate exposes `devxtension/messaging` to Webpack and CommonJS/TypeScript consumers. Applications can share a protocol definition across extension realms. Each receiver explicitly opens its endpoint and owns its bindings. Stage 2B.1 adds no automatic background registration, manifest permissions, npm dependencies or factory hooks.

The implementation follows [ADR-001](ADR-001.md). Two refinements to its sketches are the explicit endpoint handle and a sanitized `busy` failure for capacity exhaustion. Separate endpoint and binding ownership lets an active protocol answer `noHandler` between registrations and lets independent groups register atomically. Importing the entry has no Chrome side effects.

## Consumer example

```ts
// Shared contract
import { defineProtocol, event, request, Validator } from 'devxtension/messaging'

const title: Validator<string> = {
  parse(value) {
    if (typeof value !== 'string' || value.length > 160) throw new Error('Invalid title')
    return value
  }
}

export const review = defineProtocol('review', 1, {
  lookup: request({ from: ['popup', 'content'], to: 'background', payload: title, response: title, error: title }),
  changed: event({ from: ['content'], to: 'background', payload: title })
})
```

```ts
// Worker entry, synchronously at top level on every start
const endpoint = review.endpoint('background', { contentOrigins: ['https://example.com'] })
const unbind = endpoint.register({
  lookup: ({ payload }) => ({ ok: true, value: payload }),
  changed: ({ payload }) => console.log(payload.length)
})
// The owner can call unbind(), then endpoint.dispose() when closing the endpoint.
```

```ts
// Content script
const client = review.client('content')
const result = await client.request('lookup', document.title, { role: 'background' })
if (result.ok) console.log(result.value)
await client.notify('changed', document.title, { role: 'background' })
client.dispose()
```

A worker sending a content command selects exactly one address. Use `{ role: 'content', tabId, documentId }` for a particular document, or `{ role: 'content', tabId, frameId }` for the current occupant. Prefer the authenticated sender metadata for follow-up commands. The application remains responsible for authorization of individual business resources.

## Wire contract and validation

One native call carries `{ marker: 'devxtension/messaging', protocol, version, id, name, to, kind, data }`. A reply carries `{ marker, protocol, version, id, result }`. The result is a validated success, a declared domain failure, or a fixed messaging failure code. Admission of an event returns a successful JSON null. Validators run before transmission and before invoking a handler, and on both sides for application results. Write validators that accept their own parsed JSON output and reject unknown application fields. Stack traces and thrown application values stay out of replies.

Each realm installs one synchronous internal Chrome listener when its first endpoint opens. Foreign namespaces and other destinations pass through. Sender role comes from Chrome metadata, with exact extension ID, URL and origin checks. Content senders require an explicitly allowed origin and a tab, frame and document ID. Subframes need explicit opt-in. Popup and worker paths default to the packaged manifest entries. A caller-supplied role only selects client methods.

The default local deadline is 5000 ms. Client disposal, timeout and abort clean up waiters. A lost channel can leave the business outcome unknown. Each call sends once. Removal of an active binding invalidates its outstanding request completion. Admitted work continues until its handler settles or its realm exits.

## Resource limits

Pass overrides as the fourth argument of `defineProtocol`. Limits are positive safe integers. The JSON depth override is capped at 128 to bound recursive traversal.

| Default | What it bounds | Rationale |
| --- | --- | --- |
| 65,536 bytes | UTF-8 JSON body for a payload, success or domain error, including escaped strings and punctuation | Sufficient for commands and small metadata. Bulk content needs a separate contract. |
| 16 levels | Nested JSON beneath the root at depth zero | Supports structured commands while bounding recursion. |
| 8 active handlers per sender | Content is keyed by tab, frame and document. Popup and worker each share a role bucket. | Leaves room for concurrent UI operations while limiting a single caller. |
| 64 pending | Receiver checks realm-wide active work across protocols against the accepting protocol's ceiling. Each client also caps its own pending sends. | Bounds retained callbacks and timers across ordinary tab fan-out. |

Size/depth violations yield `invalid`. Admission at capacity yields `busy`. Accepted notifications and requests consume a slot until business work settles. A permanently stalled handler can occupy a slot until realm shutdown. Client abort and timeout cannot cancel remote JavaScript.

## Verification and boundaries

The candidate workflow installs the tarball into its minimal consumer. A strict ESM Webpack 5 worker bundle imports the public subpath and checks its exported constructor. Explicit package exports support fully specified ESM resolution. Legacy CommonJS dist entry points remain available, and typesVersions supports TypeScript's classic Node resolver. It compiles [the strict TypeScript fixture](../../tests/messaging-consumer.ts) with the installed compiler and executes [the callback transport tests](../../tests/messaging-transport.cjs) against that installed entry. The fixture checks correlated union arguments, sender narrowing, response and domain errors, role restrictions and exclusive destinations. Native callbacks are simulated in these transport unit tests. The existing factory, minimal-extension and Dev Reload Chromium tests exercise their original scenarios.

Run `node tests/verify-runtime.cjs` with the three environment variables in [the candidate workflow](../../.github/workflows/verify-runtime.yml). The run records per-step exit codes and package integrity in its isolated scratch directory. The runtime package has a production build script and no dedicated lint script.

Stage 2B.2 still needs to exercise **this packaged transport** in a real worker, popup and navigated iframe, including worker termination, channel loss, sender identity and stale-document handling. The transport consumes browser-reported identity and maps explicit native missing-target messages to `unavailable`. Ambiguous failures map to `channelClosed`. Chrome error wording and behavior across versions remain integration risks. Production worker generation and registration via existing lifecycle owners belong to a later stage.
