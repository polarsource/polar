// Generated from events:list_names (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, nullableStringFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['events']['listNames']>[0]>

export const command = Command.make(
  'list_names',
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
      customer_id: Flag.String('customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by customer ID.')),
      external_customer_id: Flag.String('external-customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by external customer ID.'),
        ),
      source: Flag.Literals('source', ['system', 'user'])
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by event source.')),
      query: nullableStringFlag('query').pipe(
        Flag.optional,
        Flag.withDescription('Query to filter event names.'),
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
        'name',
        '-name',
        'occurrences',
        '-occurrences',
        'first_seen',
        '-first_seen',
        'last_seen',
        '-last_seen',
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
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
        source: config.input.source,
        query: config.input.query,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'events:list_names',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        invoke: (client) => client.events.listNames(query),
      })
    }),
).pipe(Command.withDescription('List event names.'))
