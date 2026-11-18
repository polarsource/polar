// Generated from customer_meters:reverse_credit (2027-01). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { confirm, fields } from '../inputs'

export const command = Command.make(
  'reverse_credit',
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
        operationId: 'customer_meters:reverse_credit',
        apiVersion: '2027-01',
        method: 'POST',
        requiresConfirmation: true,
        confirm: config.confirm,
        fields: config.fields,
        invoke: (client) => client.customerMeters.reverseCredit(config.path.id),
      })
    }),
).pipe(
  Command.withDescription(
    "Reverse a manual credit, removing the units the customer hasn't used yet. (preview, API 2027-01)",
  ),
)
