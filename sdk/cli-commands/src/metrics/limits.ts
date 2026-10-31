// Generated from metrics:limits (2026-10). Do not edit.
import { Effect } from 'effect'
import { Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'limits',
  {
    org,
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
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) => client.metrics.limits(),
      })
    }),
).pipe(
  Command.withDescription('Get the interval limits for the metrics endpoint.'),
)
