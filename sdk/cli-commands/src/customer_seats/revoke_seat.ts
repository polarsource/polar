// Generated from customer-seats:revoke_seat (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { confirm } from '../inputs'

export const command = Command.make(
  'revoke_seat',
  {
    confirm,
    path: {
      seat_id: Argument.string('seat_id'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customer-seats:revoke_seat',
        method: 'DELETE',
        confirm: config.confirm,
        invoke: (client) =>
          client.customerSeats.revokeSeat(config.path.seat_id),
      })
    }),
).pipe(Command.withDescription('**Scopes**: `customer_seats:write`'))
