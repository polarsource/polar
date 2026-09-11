// Generated from customer-seats:resend_invitation (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'resend_invitation',
  {
    path: {
      seat_id: Argument.string('seat_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customer-seats:resend_invitation',
        method: 'POST',
        confirm: false,
        invoke: (client) =>
          client.customerSeats.resendInvitation(config.path.seat_id),
      })
    }),
).pipe(Command.withDescription('**Scopes**: `customer_seats:write`'))
