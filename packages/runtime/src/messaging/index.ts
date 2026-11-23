import { createClient } from './client'
import { Budgets, Definitions, Receiver, Role, SenderPolicy } from './contract'
import { openEndpoint } from './dispatcher'
import { label, limits, positive } from './wire'

export * from './contract'

export function defineProtocol<const D extends Definitions>(
  namespace: string, version: number, definitions: D, options: Partial<Budgets> = {}
) {
  if (!label(namespace) || !positive(version)) throw new Error('Invalid protocol identity')
  const budgets = limits(options)
  const specs = new Map<string, Definitions[string]>()
  for (const [name, spec] of Object.entries(definitions)) {
    if (!label(name) || !['background', 'content'].includes(spec.to)
        || !Array.isArray(spec.from) || !spec.from.length || !spec.from.every(role => ['content', 'popup', 'background'].includes(role))
        || !['request', 'event'].includes(spec.kind) || typeof spec.payload?.parse !== 'function'
        || (spec.kind === 'request' && (typeof spec.response?.parse !== 'function' || typeof spec.error?.parse !== 'function'))) {
      throw new Error('Invalid messaging definition: ' + name)
    }
    specs.set(name, { ...spec, from: [...spec.from] })
  }

  return {
    client<R extends Role>(role: R) {
      return createClient<D, R>(namespace, version, specs, role, budgets)
    },
    endpoint<R extends Receiver>(role: R, policy: SenderPolicy = {}) {
      return openEndpoint<D, R>(namespace, version, specs, budgets, role, policy)
    }
  }
}
