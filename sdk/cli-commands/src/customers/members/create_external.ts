// Generated from customers:members:create_external (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { data, mergeInput } from '../../inputs'

type Body = NonNullable<
  Parameters<Polar['customers']['members']['createExternal']>[1]
>

export const command = Command.make(
  'create_external',
  {
    path: {
      external_id: Argument.string('external_id'),
    },
    data,
    input: {
      email: Flag.string('email').pipe(
        Flag.optional,
        Flag.withDescription('The email address of the member.'),
      ),
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      external_id: Flag.string('external-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'The ID of the member in your system. This must be unique within the customer. ',
        ),
      ),
      role: Flag.choice('role', ['member', 'billing_manager']).pipe(
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
