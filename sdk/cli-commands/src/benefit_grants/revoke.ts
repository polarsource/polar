// Generated from benefit-grants:revoke (2027-01). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { confirm, fields } from '../inputs'

export const command = Command.make(
  'revoke',
  {
    confirm,
    fields,
    path: {
      id: Argument.String('id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'benefit-grants:revoke',
        apiVersion: '2027-01',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        fields: config.fields,
        invoke: (client) => client.benefitGrants.revoke(config.path.id),
      })
    }),
).pipe(
  Command.withDescription(
    'Manually revoke a benefit grant, including grants from purchases. (preview, API 2027-01)',
  ),
)
