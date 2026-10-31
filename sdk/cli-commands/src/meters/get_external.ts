// Generated from meters:get_external (2027-01). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'get_external',
  {
    org,
    fields,
    path: {
      external_id: Argument.String('external_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'meters:get_external',
        apiVersion: '2027-01',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) => client.meters.getExternal(config.path.external_id),
      })
    }),
).pipe(
  Command.withDescription('Get a meter by external ID. (preview, API 2027-01)'),
)
