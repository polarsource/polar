// Generated from metrics:limits (2026-04). Do not edit.
import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make('limits', {}, () =>
  Effect.gen(function* () {
    const api = yield* ApiRuntime
    yield* api.execute({
      operationId: 'metrics:limits',
      method: 'GET',
      confirm: false,
      invoke: (client) => client.metrics.limits(),
    })
  }),
).pipe(
  Command.withDescription('Get the interval limits for the metrics endpoint.'),
)
