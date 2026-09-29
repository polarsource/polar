// Generated from customers:members:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { data, mergeInput, nullableStringFlag } from '../../inputs'

type Body = NonNullable<Parameters<Polar['customers']['members']['update']>[2]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.String('id'),
      member_id: Argument.String('member_id'),
    },
    data,
    input: {
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      email: nullableStringFlag('email').pipe(
        Flag.optional,
        Flag.withDescription('email'),
      ),
      role: Flag.Literals('role', ['owner', 'billing_manager', 'member']).pipe(
        Flag.optional,
        Flag.withDescription('The role of the member within the customer.'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        name: config.input.name,
        email: config.input.email,
        role: config.input.role,
      })
      yield* api.execute({
        operationId: 'customers:members:update',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.members.update(
            config.path.id,
            config.path.member_id,
            body,
          ),
      })
    }),
).pipe(Command.withDescription('Update a member of a customer.'))
