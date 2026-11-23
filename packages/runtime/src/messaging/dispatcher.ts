import { Budgets, Definitions, Endpoint, Handlers, Receiver, Result, Sender, SenderPolicy } from './contract'
import { senderVerifier } from './sender'
import { exact, failure, label, marker, parse, positive, record, result } from './wire'

type Reply = (value: unknown) => void
type Dispatch = (message: Record<string, unknown>, sender: chrome.runtime.MessageSender, reply: Reply) => boolean
type Callback = (context: { payload: unknown, sender: Sender }) => unknown

// The registry is realm-local, including when independent bundles contain copies of this transport.
const registryKey = Symbol.for('devxtension/messaging/dispatcher-v1')
interface Registry {
  routes: Map<string, Dispatch>
  listener: typeof listener
  counts: Map<string, number>
  pending: number
}

function listener(message: unknown, sender: chrome.runtime.MessageSender, reply: Reply) {
  if (!record(message) || message.marker !== marker || !label(message.protocol)) return false
  if (message.to !== 'background' && message.to !== 'content') return false
  return registry().routes.get(message.to + ':' + message.protocol)?.(message, sender, reply) ?? false
}

function registry(): Registry {
  const realm = globalThis as typeof globalThis & { [registryKey]?: Registry }
  return realm[registryKey] ??= { routes: new Map(), listener, counts: new Map(), pending: 0 }
}

export function openEndpoint<D extends Definitions, R extends Receiver>(
  namespace: string, version: number, specs: ReadonlyMap<string, Definitions[string]>, budgets: Budgets,
  role: R, policy: SenderPolicy
): Endpoint<D, R> {
  const state = registry()
  const route = role + ':' + namespace
  if (state.routes.has(route)) throw new Error('Duplicate protocol endpoint')
  const verify = senderVerifier(policy)
  const bindings = new Map<string, { invoke: Callback }>()
  let disposed = false

  const dispatch: Dispatch = (message, metadata, sendResponse) => {
    if (!label(message.id) || !positive(message.version)) return false
    const reply = (outcome: Result<unknown, unknown>) => {
      try {
        sendResponse({ marker, protocol: namespace, version: message.version, id: message.id, result: outcome })
      } catch {
        // Chrome can close the channel while the handler is running. Never replay the reply.
      }
      return false
    }

    const sender = verify(metadata)
    if (!sender) return reply(failure('forbidden'))
    if (message.version !== version) return reply(failure('unsupportedVersion'))
    if (!exact(message, ['marker', 'protocol', 'version', 'id', 'name', 'to', 'kind', 'data']) || !label(message.name)) {
      return reply(failure('invalid'))
    }

    const name = message.name
    const spec = specs.get(name)
    if (!spec || spec.to !== role) return reply(failure('noHandler'))
    if (!spec.from.includes(sender.role)) return reply(failure('forbidden'))
    if (spec.kind !== message.kind) return reply(failure('invalid'))
    const binding = bindings.get(name)
    if (!binding) return reply(failure('noHandler'))

    const key = sender.role === 'content' ? [sender.tabId, sender.frameId, sender.documentId].join(':') : sender.role
    const count = state.counts.get(key) || 0
    if (count >= budgets.maxPerSender || state.pending >= budgets.maxPending) return reply(failure('busy'))
    let payload: unknown
    try {
      payload = parse(spec.payload, message.data, budgets)
    } catch {
      return reply(failure('invalid'))
    }

    state.pending++
    state.counts.set(key, count + 1)
    const execute = async () => {
      try {
        const output = await binding.invoke({ payload, sender })
        if (spec.kind === 'request') {
          let validated: Result<unknown, unknown>
          try {
            validated = result(spec, output, budgets, false)
          } catch {
            validated = failure('invalid')
          }
          reply(bindings.get(name) === binding ? validated : failure('aborted'))
        }
      } catch {
        if (spec.kind === 'request') reply(failure(bindings.get(name) === binding ? 'handlerFailed' : 'aborted'))
      } finally {
        state.pending--
        const remaining = (state.counts.get(key) ?? 1) - 1
        if (remaining) state.counts.set(key, remaining)
        else state.counts.delete(key)
      }
    }

    if (spec.kind === 'event') {
      reply({ ok: true, value: null })
      void execute()
      return false
    }

    void execute()
    return true
  }

  if (!state.routes.size) chrome.runtime.onMessage.addListener(state.listener)
  state.routes.set(route, dispatch)

  return {
    register(handlers: Handlers<D, R>) {
      if (disposed) throw new Error('Disposed messaging endpoint')
      const additions = Object.entries(handlers).map(([name, invoke]) => {
        if (typeof invoke !== 'function' || specs.get(name)?.to !== role || bindings.has(name)) {
          throw new Error('Invalid or duplicate handler: ' + name)
        }
        return [name, { invoke: invoke as Callback }] as const
      })
      for (const [name, binding] of additions) bindings.set(name, binding)
      return () => {
        for (const [name, binding] of additions) {
          if (bindings.get(name) === binding) bindings.delete(name)
        }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      bindings.clear()
      state.routes.delete(route)
      if (!state.routes.size) chrome.runtime.onMessage.removeListener(state.listener)
    }
  }
}
