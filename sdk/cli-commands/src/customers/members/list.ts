// Generated from customers:members:list (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { data, mergeInput } from '../../inputs'

type Query = NonNullable<Parameters<Polar['customers']['members']['list']>[1]>

export const command = Command.make(
  'list',
  {
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      role: Flag.Literals('role', ['owner', 'billing_manager', 'member']).pipe(
        Flag.optional,
        Flag.withDescription('Filter by member role.'),
      ),
      page: Flag.Int('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.Int('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.Literals('sorting', ['created_at', '-created_at'])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.',
          ),
        ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        role: config.input.role,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'customers:members:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.members.list(config.path.id, query),
      })
    }),
).pipe(Command.withDescription('List the members of a customer.'))
