import type { Environment, Polar } from '@polar-sh/sdk/2026-04'
import { Context, Data, type Effect, type Stdio } from 'effect'
import type { Prompt } from 'effect/unstable/cli'

export type { Environment } from '@polar-sh/sdk/2026-04'

export class ApiCommandError extends Data.TaggedError('ApiCommandError')<{
  message: string
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
  environment?: Environment
  requiresConfirmation: boolean
  confirm: boolean
  preview?: ApiPreview
  invoke: (client: Polar) => Promise<A>
}

export class ApiRuntime extends Context.Service<
  ApiRuntime,
  {
    execute: <A>(
      operation: ApiOperation<A>,
    ) => Effect.Effect<void, ApiCommandError, Stdio.Stdio | Prompt.Environment>
  }
>()('@polar-sh/cli-commands/ApiRuntime') {}
