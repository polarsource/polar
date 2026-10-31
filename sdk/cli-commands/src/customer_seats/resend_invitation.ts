// Generated from customer-seats:resend_invitation (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { fields, org } from '../inputs'

export const command = Command.make(
  'resend_invitation',
  {
    org,
    fields,
    path: {
      seat_id: Argument.String('seat_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customer-seats:resend_invitation',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) =>
          client.customerSeats.resendInvitation(config.path.seat_id),
      })
    }),
).pipe(
  Command.withDescription('Resend an invitation for a pending customer seat.'),
)
