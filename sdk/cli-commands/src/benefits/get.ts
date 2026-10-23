// Generated from benefits:get (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'get',
  {
    org,
    fields,
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'benefits:get',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) => client.benefits.get(config.path.id),
      })
    }),
).pipe(Command.withDescription('Get a benefit by ID.'))
