// Generated from customer-seats:get_claim_info (2026-10). Do not edit.
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, executeRequest } from '../runtime'

export const command = Command.make(
  'get_claim_info',
  {
    environment: Flag.Literals('environment', ['production', 'sandbox']).pipe(
      Flag.withDefault('production'),
      Flag.withDescription('Environment for this unauthenticated request'),
    ),
    path: {
      invitation_token: Argument.String('invitation_token'),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      yield* api.execute({
        operationId: 'customer-seats:get_claim_info',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        requiresAuthentication: false,
        environment: config.environment,
        invoke: (_client, core) =>
          executeRequest(
            core,
            core.buildRequest(
              'GET',
              '/v1/customer-seats/claim/{invitation_token}',
              { invitation_token: config.path.invitation_token },
              undefined,
              undefined,
            ),
            'json',
            {
              anonymous: true,
            },
          ),
      })
    }),
).pipe(Command.withDescription('get_claim_info'))
