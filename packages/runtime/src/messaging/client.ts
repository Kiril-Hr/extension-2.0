import { Budgets, Client, Definitions, Destination, FailureCode, Result, Role, SendOptions } from './contract'
import { exact, failure, marker, parse, positive, record, result } from './wire'

function validTarget(target: Destination) {
  if (!record(target)) return false
  if (target.role === 'background') return exact(target, ['role'])
  if (target.role !== 'content' || !Number.isSafeInteger(target.tabId) || target.tabId < 0) return false

  if (exact(target, ['role', 'tabId', 'frameId'])) return typeof target.frameId === 'number' && Number.isSafeInteger(target.frameId) && target.frameId >= 0
  return exact(target, ['role', 'tabId', 'documentId']) && typeof target.documentId === 'string'
    && target.documentId.length > 0 && target.documentId.length <= 128
}

function channelFailure(message = ''): FailureCode {
  return /receiving end does not exist|no tab with id|no frame with id|no document with id/i.test(message)
    ? 'unavailable' : 'channelClosed'
}

export function createClient<D extends Definitions, R extends Role>(
  protocol: string, version: number, specs: ReadonlyMap<string, Definitions[string]>, role: R, budgets: Budgets
): Client<D, R> {
  const pending = new Set<() => void>()
  let disposed = false

  async function send(
    kind: 'request' | 'event', name: string, payload: unknown, target: Destination, options: SendOptions = {}
  ): Promise<Result<unknown, unknown>> {
    if (disposed || options.signal?.aborted) return failure('aborted')
    if (pending.size >= budgets.maxPending) return failure('busy')
    const spec = specs.get(name)
    const timeout = options.timeoutMs ?? 5000
    if (!positive(timeout) || timeout > 2147483647 || !validTarget(target) || spec?.to !== target.role
        || spec.kind !== kind || !spec.from.includes(role)) return failure('invalid')

    let data: unknown
    try {
      data = parse(spec.payload, payload, budgets)
    } catch {
      return failure('invalid')
    }
    const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), word => word.toString(16).padStart(8, '0')).join('')
    const message = { marker, protocol, version, id, name, to: target.role, kind, data }

    return new Promise(resolve => {
      const finish = (outcome: Result<unknown, unknown>) => {
        if (!pending.delete(abort)) return
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', abort)
        resolve(outcome)
      }
      const abort = () => finish(failure('aborted'))
      const timer = setTimeout(() => finish(failure('timeout')), timeout)
      pending.add(abort)
      options.signal?.addEventListener('abort', abort)
      if (disposed || options.signal?.aborted) return abort()

      const receive = (reply: unknown) => {
        const lastError = chrome.runtime.lastError
        if (!pending.has(abort)) return
        if (lastError) return finish(failure(channelFailure(lastError.message)))
        if (reply === undefined || reply === null) return finish(failure('channelClosed'))
        if (!record(reply) || !exact(reply, ['marker', 'protocol', 'version', 'id', 'result'])
            || reply.marker !== marker || reply.protocol !== protocol || reply.version !== version || reply.id !== id) {
          return finish(failure('invalid'))
        }
        try {
          finish(result(spec, reply.result, budgets, true))
        } catch {
          finish(failure('invalid'))
        }
      }

      try {
        if (target.role === 'background') chrome.runtime.sendMessage(message, receive)
        else {
          const address = target.documentId !== undefined ? { documentId: target.documentId } : { frameId: target.frameId }
          chrome.tabs.sendMessage(target.tabId, message, address, receive)
        }
      } catch {
        finish(failure('channelClosed'))
      }
    })
  }

  // Dynamic dispatch validates the same definition selected by the public correlated tuple.
  return {
    request: send.bind(undefined, 'request'),
    notify: send.bind(undefined, 'event'),
    dispose() {
      disposed = true
      for (const abort of pending) abort()
    }
  } as Client<D, R>
}
