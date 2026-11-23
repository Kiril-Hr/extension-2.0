export interface Validator<T> {
  parse(value: unknown): T
}

export type Destination =
  | { role: 'background' }
  | { role: 'content', tabId: number, documentId: string, frameId?: never }
  | { role: 'content', tabId: number, frameId: number, documentId?: never }

export type Sender =
  | { role: 'content', origin: string, tabId: number, frameId: number, documentId: string }
  | { role: 'popup', url: string }
  | { role: 'background', extensionId: string }

export type Role = Sender['role']
export type Receiver = Destination['role']
export type FailureCode = 'invalid' | 'forbidden' | 'unsupportedVersion' | 'noHandler' | 'unavailable'
  | 'channelClosed' | 'timeout' | 'aborted' | 'handlerFailed' | 'busy'

type Success<T> = { ok: true, value: T }
type Rejection<E> = { ok: false, kind: 'domain', error: E }
export type Failure = { ok: false, kind: 'messaging', code: FailureCode }
export type Result<T, E> = Success<T> | Rejection<E> | Failure

interface Base {
  readonly from: readonly Role[]
  readonly to: Receiver
  readonly payload: Validator<unknown>
}

interface Query extends Base {
  readonly response: Validator<unknown>
  readonly error: Validator<unknown>
}

export function request<const S extends Query>(spec: S) {
  return { ...spec, kind: 'request' as const }
}

export function event<const S extends Base>(spec: S) {
  return { ...spec, kind: 'event' as const }
}

export type Definition = (Query & { kind: 'request' }) | (Base & { kind: 'event' })
export type Definitions = Record<string, Definition>
type Parsed<V> = V extends Validator<infer T> ? T : never
export type Request<S extends Definition> = Parsed<S['payload']>
export type Response<S extends Definition> = S extends Query ? Parsed<S['response']> : never
export type DomainError<S extends Definition> = S extends Query ? Parsed<S['error']> : never

export interface SendOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

type Arguments<D extends Definitions, R extends Role, Kind extends Definition['kind']> = {
  [K in keyof D & string]: R extends D[K]['from'][number] ? D[K]['kind'] extends Kind
    ? [name: K, payload: Request<D[K]>, target: Extract<Destination, { role: D[K]['to'] }>, options?: SendOptions]
    : never : never
}[keyof D & string]

export interface Client<D extends Definitions, R extends Role> {
  request<A extends Arguments<D, R, 'request'>>(...args: A): Promise<Result<Response<D[A[0]]>, DomainError<D[A[0]]>>>
  notify(...args: Arguments<D, R, 'event'>): Promise<Success<null> | Failure>
  dispose(): void
}

type Awaitable<T> = PromiseLike<T> | T
export type Handlers<D extends Definitions, R extends Receiver> = {
  [K in keyof D as D[K]['to'] extends R ? K : never]?: (context: {
    payload: Request<D[K]>
    sender: Extract<Sender, { role: D[K]['from'][number] }>
  }) => D[K]['kind'] extends 'event' ? Awaitable<void> : Awaitable<Success<Response<D[K]>> | Rejection<DomainError<D[K]>>>
}

export interface SenderPolicy {
  contentOrigins?: readonly string[]
  allowSubframes?: boolean
  popupPath?: string
}

export interface Budgets {
  maxBytes: number
  maxDepth: number
  maxPerSender: number
  maxPending: number
}

export interface Endpoint<D extends Definitions, R extends Receiver> {
  register(handlers: Handlers<D, R>): () => void
  dispose(): void
}
