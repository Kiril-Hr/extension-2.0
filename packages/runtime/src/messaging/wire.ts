import { Budgets, Definition, Failure, FailureCode, Result, Validator } from './contract'

export const marker = 'devxtension/messaging'
export const defaults: Budgets = { maxBytes: 65536, maxDepth: 16, maxPerSender: 8, maxPending: 64 }

export function failure(code: FailureCode): Failure {
  return { ok: false, kind: 'messaging', code }
}

export function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false

  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export function exact(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

export function label(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,96}$/.test(value)
}

export function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function limits(options: Partial<Budgets>): Budgets {
  const budgets = { ...defaults, ...options }
  if (!Object.values(budgets).every(positive) || budgets.maxDepth > 128) throw new Error('Invalid messaging budgets')
  return Object.freeze(budgets)
}

function plainArray(value: unknown[]) {
  const proto = Object.getPrototypeOf(value)
  if (proto === Array.prototype) return true
  if (!Array.isArray(proto)) return false

  // An ordinary array from another realm has that realm's intrinsic Array.prototype.
  const constructor = Object.getOwnPropertyDescriptor(proto, 'constructor')?.value
  return typeof constructor === 'function' && constructor.prototype === proto
    && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Array)
}

// Account for JSON punctuation, escaping and UTF-8 bytes before calling user validators.
// Traverse data descriptors only. Chrome would silently coerce several non-JSON JS values.
export function checkJson(value: unknown, budgets: Budgets) {
  let bytes = 0
  const ancestors = new Set<object>()
  const encoder = new TextEncoder()
  const invalid: () => never = () => { throw new Error('Invalid messaging data') }

  function add(size: number) {
    bytes += size
    if (bytes > budgets.maxBytes) invalid()
  }

  function stringSize(text: string) {
    if (text.length > budgets.maxBytes - bytes) invalid()
    add(encoder.encode(JSON.stringify(text)).length)
  }

  function visit(item: unknown, depth: number) {
    if (depth > budgets.maxDepth) invalid()
    if (typeof item === 'string') return stringSize(item)
    if (item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) {
      return add(JSON.stringify(item).length)
    }
    if (!item || typeof item !== 'object') throw new Error('Non-JSON messaging data')
    if (ancestors.has(item)) invalid()

    const array = Array.isArray(item)
    if (array ? !plainArray(item) : !record(item)) invalid()
    ancestors.add(item)
    add(2)

    let count = 0
    for (const key of Reflect.ownKeys(item)) {
      if (array && key === 'length') continue
      if (typeof key !== 'string') throw new Error('Invalid JSON key')
      const field = Object.getOwnPropertyDescriptor(item, key)
      if (!field?.enumerable || !Object.hasOwn(field, 'value')) invalid()
      if (count) add(1)
      if (array) {
        if (String(count) !== key) invalid()
      } else {
        stringSize(key)
        add(1)
      }
      visit(field.value, depth + 1)
      count++
    }

    if (array && count !== item.length) invalid()
    ancestors.delete(item)
  }

  visit(value, 0)
}

export function parse(schema: Validator<unknown>, input: unknown, budgets: Budgets) {
  checkJson(input, budgets)
  const value = schema.parse(input)
  checkJson(value, budgets)
  return value
}

const codes = new Set<FailureCode>([
  'invalid', 'forbidden', 'unsupportedVersion', 'noHandler', 'unavailable', 'channelClosed',
  'timeout', 'aborted', 'handlerFailed', 'busy'
])

export function result(spec: Definition, input: unknown, budgets: Budgets, wire: boolean): Result<unknown, unknown> {
  if (!record(input)) return failure('invalid')
  if (input.ok === true && exact(input, ['ok', 'value'])) {
    if (spec.kind === 'event') return input.value === null ? { ok: true, value: null } : failure('invalid')
    return { ok: true, value: parse(spec.response, input.value, budgets) }
  }

  if (input.ok === false && input.kind === 'domain' && spec.kind === 'request' && exact(input, ['ok', 'kind', 'error'])) {
    return { ok: false, kind: 'domain', error: parse(spec.error, input.error, budgets) }
  }
  if (wire && input.ok === false && input.kind === 'messaging' && exact(input, ['ok', 'kind', 'code'])
      && codes.has(input.code as FailureCode)) return failure(input.code as FailureCode)
  return failure('invalid')
}
