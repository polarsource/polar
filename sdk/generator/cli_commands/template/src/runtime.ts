import type { Polar } from '@polar-sh/sdk/2026-04'
import { Context, Data, type Effect } from 'effect'

export type Environment = 'sandbox' | 'production'

export class ApiCommandError extends Data.TaggedError('ApiCommandError')<{
  message: string
}> {}

export interface ApiOperation<A> {
  operationId: string
  method: string
  environment: Environment
  confirm: boolean
  invoke: (client: Polar) => Promise<A>
}

export class ApiRuntime extends Context.Service<
  ApiRuntime,
  {
    execute: <A>(operation: ApiOperation<A>) => Effect.Effect<void, ApiCommandError>
  }
>()('@polar-sh/cli-commands/ApiRuntime') {}
