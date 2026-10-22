// Generated from customer-seats:revoke_seat (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import { confirm, fields, org } from '../inputs'

export const command = Command.make(
  'revoke_seat',
  {
    confirm,
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
        operationId: 'customer-seats:revoke_seat',
        method: 'DELETE',
        requiresConfirmation: true,
        confirm: config.confirm,
        organizationId: config.org,
        fields: config.fields,
        invoke: (client) =>
          client.customerSeats.revokeSeat(config.path.seat_id),
      })
    }),
).pipe(Command.withDescription('Revoke a customer seat.'))
