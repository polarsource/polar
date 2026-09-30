// Generated from discounts:list (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, nullableStringFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['discounts']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      organization_id: Flag.String('organization-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.withAlias('org'),
          Flag.optional,
          Flag.withDescription(
            'Filter by organization ID. Defaults to the active organization.',
          ),
        ),
      query: nullableStringFlag('query').pipe(
        Flag.optional,
        Flag.withDescription('Filter by name.'),
      ),
      page: Flag.Int('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.Int('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.Literals('sorting', [
        'created_at',
        '-created_at',
        'name',
        '-name',
        'code',
        '-code',
        'redemptions_count',
        '-redemptions_count',
        'ends_at',
        '-ends_at',
      ])
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
        organization_id: config.input.organization_id,
        query: config.input.query,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'discounts:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        invoke: (client) => client.discounts.list(query),
      })
    }),
).pipe(Command.withDescription('List discounts.'))
