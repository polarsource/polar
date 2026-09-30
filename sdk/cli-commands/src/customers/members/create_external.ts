// Generated from customers:members:create_external (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../../runtime'
import {
  data,
  mergeInput,
  missingFlags,
  nullableStringFlag,
} from '../../inputs'

type Body = NonNullable<
  Parameters<Polar['customers']['members']['createExternal']>[1]
>

export const command = Command.make(
  'create_external',
  {
    path: {
      external_id: Argument.String('external_id'),
    },
    data,
    input: {
      email: Flag.String('email').pipe(
        Flag.optional,
        Flag.withDescription('Required. The email address of the member.'),
      ),
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      external_id: nullableStringFlag('external-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'The ID of the member in your system. This must be unique within the customer. ',
        ),
      ),
      role: Flag.Literals('role', ['member', 'billing_manager']).pipe(
        Flag.optional,
        Flag.withDescription(
          'The role of the member within the customer. To assign or transfer ownership, use the member update endpoint.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        email: config.input.email,
        name: config.input.name,
        external_id: config.input.external_id,
        role: config.input.role,
      })
      const missing = missingFlags(body, ['email'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar customers members create_external <external_id> --email member@example.com',
        })
      }
      yield* api.execute({
        operationId: 'customers:members:create_external',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.members.createExternal(
            config.path.external_id,
            body,
          ),
      })
    }),
).pipe(
  Command.withDescription(
    'Create a new member for a customer identified by its external ID.',
  ),
)
