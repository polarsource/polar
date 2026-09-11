// Generated from customers:members:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { data, mergeInput } from '../../inputs'

type Body = NonNullable<Parameters<Polar['customers']['members']['update']>[2]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.string('id'),
      member_id: Argument.string('member_id'),
    },
    data,
    input: {
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      email: Flag.string('email').pipe(
        Flag.optional,
        Flag.withDescription('email'),
      ),
      role: Flag.choice('role', ['owner', 'billing_manager', 'member']).pipe(
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
