// Generated from events:list (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime } from '../runtime'
import {
  fields,
  data,
  mergeInput,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Query = NonNullable<Parameters<Polar['events']['list']>[0]>

export const command = Command.make(
  'list',
  {
    fields,
    data,
    input: {
      filter: nullableStringFlag('filter').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter events following filter clauses. JSON string following the same schema a meter filter clause. ',
        ),
      ),
      start_timestamp: nullableStringFlag('start-timestamp').pipe(
        Flag.optional,
        Flag.withDescription('Filter events after this timestamp.'),
      ),
      end_timestamp: nullableStringFlag('end-timestamp').pipe(
        Flag.optional,
        Flag.withDescription('Filter events before this timestamp.'),
      ),
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
      meter_id: nullableStringFlag('meter-id').pipe(
        Flag.optional,
        Flag.withDescription('Filter by a meter filter clause.'),
      ),
      name: Flag.String('name')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by event name.')),
      source: Flag.Literals('source', ['system', 'user'])
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by event source.')),
      query: nullableStringFlag('query').pipe(
        Flag.optional,
        Flag.withDescription('Query to filter events.'),
      ),
      parent_id: nullableStringFlag('parent-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'When combined with depth, use this event as the anchor instead of root events.',
        ),
      ),
      depth: Flag.Int('depth').pipe(
        Flag.optional,
        Flag.withDescription(
          'Fetch descendants up to this depth. When set: 0=root events only, 1=roots+children, etc. Max 5. When not set, returns all events.',
        ),
      ),
      page: Flag.Int('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.Int('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
      sorting: Flag.Literals('sorting', ['timestamp', '-timestamp'])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.',
          ),
        ),
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by metadata key-value pairs. JSON: {"<key>": string | integer | boolean | array of string | array of integer | array of boolean}',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        filter: config.input.filter,
        start_timestamp: config.input.start_timestamp,
        end_timestamp: config.input.end_timestamp,
        organization_id: config.input.organization_id,
        customer_id: config.input.customer_id,
        external_customer_id: config.input.external_customer_id,
        meter_id: config.input.meter_id,
        name: config.input.name,
        source: config.input.source,
        query: config.input.query,
        parent_id: config.input.parent_id,
        depth: config.input.depth,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
        metadata: config.input.metadata,
      })
      yield* api.execute({
        operationId: 'events:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        fields: config.fields,
        invoke: (client) => client.events.list(query),
      })
    }),
).pipe(Command.withDescription('List events.'))
