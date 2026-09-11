// Generated from event-types:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['eventTypes']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      organization_id: Flag.string('organization-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.withAlias('org'),
          Flag.optional,
          Flag.withDescription('Filter by organization ID.'),
        ),
      customer_id: Flag.string('customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by customer ID.')),
      external_customer_id: Flag.string('external-customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by external customer ID.'),
        ),
      query: Flag.string('query').pipe(
        Flag.optional,
        Flag.withDescription('Query to filter event types by name or label.'),
      ),
      root_events: Flag.boolean('root-events').pipe(
        Flag.optional,
        Flag.withDescription(
          'When true, only return event types with root events (parent_id IS NULL).',
        ),
      ),
      parent_id: Flag.string('parent-id').pipe(
        Flag.optional,
        Flag.withDescription('Filter by specific parent event ID.'),
      ),
      source: Flag.choice('source', ['system', 'user']).pipe(
        Flag.optional,
        Flag.withDescription('Filter by event source (system or user).'),
      ),
      page: Flag.integer('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.integer('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.choice('sorting', [
        'name',
        '-name',
        'label',
        '-label',
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
        query: config.input.query,
        root_events: config.input.root_events,
        parent_id: config.input.parent_id,
        source: config.input.source,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'event-types:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.eventTypes.list(query),
      })
    }),
).pipe(Command.withDescription('List event types with aggregated statistics.'))
