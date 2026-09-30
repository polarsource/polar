import type { Environment, Polar, PolarCore } from '@polar-sh/sdk/{{ api.version }}'
import { Context, Data, type Effect, type Stdio } from 'effect'
import type { Prompt } from 'effect/unstable/cli'

export type { Environment } from '@polar-sh/sdk/{{ api.version }}'

export class ApiCommandError extends Data.TaggedError('ApiCommandError')<{
  message: string
  hint?: string
  statusCode?: number | undefined
}> {}

export interface PreviewField {
  key: string
  label: string
}

export interface ApiPreview {
  fields: ReadonlyArray<PreviewField>
  invoke: (client: Polar) => Promise<unknown>
}

export interface ApiOperation<A> {
  operationId: string
  method: string
  requiresConfirmation: boolean
  confirm: boolean
  requiresAuthentication?: boolean
  environment?: Environment
  organizationId?: string | ReadonlyArray<string> | null | undefined
  preview?: ApiPreview
  invoke: (client: Polar, core: PolarCore) => Promise<A>
}

export const executeRequest = async (
  core: PolarCore,
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
    execute: <A>(
      operation: ApiOperation<A>,
    ) => Effect.Effect<void, ApiCommandError, Stdio.Stdio | Prompt.Environment>
  }
>()('@polar-sh/cli-commands/ApiRuntime') {}
