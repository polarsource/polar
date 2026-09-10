// Generated from customers:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { production, data, mergeInput, jsonFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['customers']['list']>[0]>

export const command = Command.make(
  'list',
  {
    production,
    data,
    organization_id: Flag.string('organization-id')
      .pipe(Flag.atLeast(1))
      .pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription('Filter by organization ID.'),
      ),
    email: Flag.string('email').pipe(
      Flag.optional,
      Flag.withDescription('Filter by exact email.'),
    ),
    query: Flag.string('query').pipe(
      Flag.optional,
      Flag.withDescription('Filter by name, email, or external ID.'),
    ),
    active: Flag.boolean('active').pipe(
      Flag.optional,
      Flag.withDescription(
        'Filter by active customers, i.e. customers with at least one trialing, active or past_due subscription.',
      ),
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
      'created_at',
      '-created_at',
      'email',
      '-email',
      'name',
      '-name',
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
        'Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.',
      ),
    ),
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        organization_id: config.organization_id,
        email: config.email,
        query: config.query,
        active: config.active,
        page: config.page,
        limit: config.limit,
        sorting: config.sorting,
        metadata: config.metadata,
      })
      yield* api.execute({
        operationId: 'customers:list',
        method: 'GET',
        environment: config.production ? 'production' : 'sandbox',
        confirm: false,
        invoke: (client) => client.customers.list(query),
      })
    }),
).pipe(Command.withDescription('List customers.'))
