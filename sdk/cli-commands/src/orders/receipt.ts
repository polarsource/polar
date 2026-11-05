// Generated from orders:receipt (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime, executeRequest } from '../runtime'
import { org } from '../inputs'

export const command = Command.make(
  'receipt',
  {
    org,
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
        organizationId: config.org,
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
