import type * as V2026_10 from '@polar-sh/sdk/2026-10'
import type * as V2027_01 from '@polar-sh/sdk/2027-01'
import { Context, Data, type Effect, type Option, type Stdio } from 'effect'
import type { Prompt } from 'effect/cli'

export type { Environment } from '@polar-sh/sdk/2026-10'

export interface ApiClients {
  '2026-10': {
    client: V2026_10.Polar
    core: V2026_10.PolarCore
  }
  '2027-01': {
    client: V2027_01.Polar
    core: V2027_01.PolarCore
  }
}

export type ApiVersion = keyof ApiClients

export const CURRENT_API_VERSION = '2026-10'

export class ApiCommandError extends Data.TaggedError('ApiCommandError')<{
  message: string
  hint?: string
  statusCode?: number | undefined
}> {}

export interface PreviewField {
  key: string
  label: string
}

export interface ApiPreview<V extends ApiVersion = ApiVersion> {
  fields: ReadonlyArray<PreviewField>
  invoke: (client: ApiClients[V]['client']) => Promise<unknown>
}

export interface ApiOperation<A, V extends ApiVersion = ApiVersion> {
  operationId: string
  apiVersion?: V
  method: string
  requiresConfirmation: boolean
  confirm: boolean
  requiresAuthentication?: boolean
  environment?: V2026_10.Environment
  organizationId?: string | ReadonlyArray<string> | null | undefined
  fields?: Option.Option<string>
  preview?: ApiPreview<V>
  invoke: (
    client: ApiClients[V]['client'],
    core: ApiClients[V]['core'],
    organizationIds: ReadonlyArray<string>,
  ) => Promise<A>
}

export const executeRequest = async (
  core: ApiClients[ApiVersion]['core'],
  [url, init]: [string, RequestInit],
  responseType: 'json' | 'text' | 'none',
  options: { anonymous?: boolean; pendingResponse?: string },
): Promise<unknown> => {
  if (options.anonymous) {
    const headers = new Headers(init.headers)
    headers.delete('Authorization')
    init = { ...init, headers }
  }
  const response = await core.sendRequest([url, init])
  if (response.status === 202 && options.pendingResponse) {
    return { status: 202, message: options.pendingResponse }
  }
  return core.parseResponse(response, responseType)
}

export class ApiRuntime extends Context.Service<
  ApiRuntime,
  {
    execute: <A, V extends ApiVersion = typeof CURRENT_API_VERSION>(
      operation: ApiOperation<A, V>,
    ) => Effect.Effect<void, ApiCommandError, Stdio.Stdio | Prompt.Environment>
  }
>()('@polar-sh/cli-commands/ApiRuntime') {}
