// Generated from metrics:limits (2026-10). Do not edit.
import { Effect } from 'effect'
import { Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields } from '../inputs'

export const command = Command.make(
  'limits',
  {
    fields,
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'metrics:limits',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.metrics.limits(),
      })
    }),
).pipe(
  Command.withDescription('Get the interval limits for the metrics endpoint.'),
)
