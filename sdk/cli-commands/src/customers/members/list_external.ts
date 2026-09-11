// Generated from customers:members:list_external (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../../runtime'
import { data, mergeInput } from '../../inputs'

type Query = NonNullable<
  Parameters<Polar['customers']['members']['listExternal']>[1]
>

export const command = Command.make(
  'list_external',
  {
    path: {
      external_id: Argument.string('external_id'),
    },
    data,
    input: {
      role: Flag.choice('role', ['owner', 'billing_manager', 'member']).pipe(
        Flag.optional,
        Flag.withDescription('Filter by member role.'),
      ),
      page: Flag.integer('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.integer('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.choice('sorting', ['created_at', '-created_at'])
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
        operationId: 'customers:members:list_external',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.customers.members.listExternal(config.path.external_id, query),
      })
    }),
).pipe(
  Command.withDescription(
    'List the members of a customer identified by its external ID.',
  ),
)
