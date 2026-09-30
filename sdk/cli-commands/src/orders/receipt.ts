// Generated from orders:receipt (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime, executeRequest } from '../runtime'

export const command = Command.make(
  'receipt',
  {
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'orders:receipt',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (_client, core) =>
          executeRequest(
            core,
            core.buildRequest(
              'GET',
              '/v1/orders/{id}/receipt',
              { id: config.path.id },
              undefined,
              undefined,
            ),
            'json',
            {
              pendingResponse: 'Receipt generation in progress.',
            },
          ),
      })
    }),
).pipe(
  Command.withDescription(
    "Get a presigned URL to download an order's receipt PDF.",
  ),
)
