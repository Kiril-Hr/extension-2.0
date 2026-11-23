type Destination =
  | { role: 'background' }
  | { role: 'content', tabId: number, frameId: number, documentId?: never }
  | { role: 'content', tabId: number, documentId: string, frameId?: never }

type Sender =
  | { role: 'content', tabId: number, frameId: number, documentId: string, origin: string }
  | { role: 'popup', url: string }
  | { role: 'background', extensionId: string }

type FailureCode = 'invalid' | 'forbidden' | 'unsupportedVersion' | 'noHandler'
  | 'unavailable' | 'channelClosed' | 'timeout' | 'aborted' | 'handlerFailed'
type Result<R, E> = { ok: true, value: R }
  | { ok: false, kind: 'domain', error: E }
  | { ok: false, kind: 'messaging', code: FailureCode }

export interface Validator<T> {
  parse(value: unknown): T
}

type Role = Sender['role']
type Spec = {
  from: Role
  to: 'background' | 'content'
  kind: 'request' | 'event'
  payload: unknown
  response: unknown
  error: unknown
}
type Protocol = Record<string, Spec>
type RequestKeys<P extends Protocol, R extends Role> = {
  [K in keyof P]: R extends P[K]['from']
    ? P[K]['kind'] extends 'request' ? K : never
    : never
}[keyof P]
type Target<S extends Spec> = Extract<Destination, { role: S['to'] }>
export type SenderOf<S extends Spec> = Extract<Sender, { role: S['from'] }>
type Options = { timeoutMs?: number, signal?: AbortSignal }
type Args<P extends Protocol, K extends keyof P> = {
  [N in K]: [name: N, payload: P[N]['payload'], target: Target<P[N]>, options?: Options]
}[K]
export interface RequestClient<P extends Protocol, R extends Role> {
  request<A extends Args<P, RequestKeys<P, R>>>(
    ...args: A
  ): Promise<Result<P[A[0]]['response'], P[A[0]]['error']>>
}

type Infer<V> = V extends Validator<infer T> ? T : never
type Definition = {
  readonly from: readonly Role[]
  readonly to: Spec['to']
  readonly kind: Spec['kind']
  readonly payload: Validator<unknown>
  readonly response: Validator<unknown>
  readonly error: Validator<unknown>
}

export declare function defineProtocol<const D extends Record<string, Definition>>(defs: D): {
  [K in keyof D]: {
    kind: D[K]['kind']
    from: D[K]['from'][number]
    to: D[K]['to']
    payload: Infer<D[K]['payload']>
    response: Infer<D[K]['response']>
    error: Infer<D[K]['error']>
  }
}
