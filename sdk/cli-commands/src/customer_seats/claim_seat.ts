// Generated from customer-seats:claim_seat (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Body = NonNullable<Parameters<Polar['customerSeats']['claimSeat']>[0]>

export const command = Command.make(
  'claim_seat',
  {
    data,
    input: {
      invitation_token: Flag.string('invitation-token').pipe(
        Flag.optional,
        Flag.withDescription('Invitation token to claim the seat'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        invitation_token: config.input.invitation_token,
      })
      yield* api.execute({
        operationId: 'customer-seats:claim_seat',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.customerSeats.claimSeat(body),
      })
    }),
).pipe(Command.withDescription('claim_seat'))
