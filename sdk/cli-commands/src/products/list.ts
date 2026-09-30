// Generated from products:list (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag, nullableStringFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['products']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      id: Flag.String('id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by product ID.')),
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
        Flag.withDescription('Filter by product name.'),
      ),
      is_archived: Flag.Boolean('is-archived').pipe(
        Flag.optional,
        Flag.withDescription('Filter on archived products.'),
      ),
      is_recurring: Flag.Boolean('is-recurring').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter on recurring products. If `true`, only subscriptions tiers are returned. If `false`, only one-time purchase products are returned. ',
        ),
      ),
      benefit_id: Flag.String('benefit-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter products granting specific benefit.'),
        ),
      visibility: Flag.Literals('visibility', ['draft', 'private', 'public'])
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by visibility.')),
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
        'price_amount_type',
        '-price_amount_type',
        'price_amount',
        '-price_amount',
      ])
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
        id: config.input.id,
        organization_id: config.input.organization_id,
        query: config.input.query,
        is_archived: config.input.is_archived,
        is_recurring: config.input.is_recurring,
        benefit_id: config.input.benefit_id,
        visibility: config.input.visibility,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
        metadata: config.input.metadata,
      })
      yield* api.execute({
        operationId: 'products:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        invoke: (client) => client.products.list(query),
      })
    }),
).pipe(Command.withDescription('List products.'))
