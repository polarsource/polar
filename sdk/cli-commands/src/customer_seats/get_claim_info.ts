// Generated from customer-seats:get_claim_info (2026-04). Do not edit.
import { Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'

export const command = Command.make(
  'get_claim_info',
  {
    path: {
      invitation_token: Argument.string('invitation_token'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customer-seats:get_claim_info',
        method: 'GET',
        confirm: false,
        invoke: (client) =>
          client.customerSeats.getClaimInfo(config.path.invitation_token),
      })
    }),
).pipe(Command.withDescription('get_claim_info'))
