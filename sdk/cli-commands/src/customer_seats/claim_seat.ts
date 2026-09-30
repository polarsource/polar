// Generated from customer-seats:claim_seat (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, executeRequest } from '../runtime'
import { data, mergeInput } from '../inputs'

type Body = NonNullable<Parameters<Polar['customerSeats']['claimSeat']>[0]>

export const command = Command.make(
  'claim_seat',
  {
    environment: Flag.Literals('environment', ['production', 'sandbox']).pipe(
      Flag.withDefault('production'),
      Flag.withDescription('Environment for this unauthenticated request'),
    ),
    data,
    input: {
      invitation_token: Flag.String('invitation-token').pipe(
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
        requiresAuthentication: false,
        environment: config.environment,
        invoke: (_client, core) =>
          executeRequest(
            core,
            core.buildRequest(
              'POST',
              '/v1/customer-seats/claim',
              undefined,
              undefined,
              body,
            ),
            'json',
            {
              anonymous: true,
            },
          ),
      })
    }),
).pipe(Command.withDescription('claim_seat'))
