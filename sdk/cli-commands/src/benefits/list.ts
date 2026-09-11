// Generated from benefits:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Query = NonNullable<Parameters<Polar['benefits']['list']>[0]>

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
      type: Flag.choice('type', [
        'custom',
        'discord',
        'github_repository',
        'downloadables',
        'license_keys',
        'meter_credit',
        'feature_flag',
        'slack_shared_channel',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by benefit type.')),
      id: Flag.string('id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by benefit IDs.')),
      exclude_id: Flag.string('exclude-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Exclude benefits with these IDs.'),
        ),
      query: Flag.string('query').pipe(
        Flag.optional,
        Flag.withDescription('Filter by description.'),
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
        'description',
        '-description',
        'type',
        '-type',
        'user_order',
        '-user_order',
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
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        organization_id: config.input.organization_id,
        type: config.input.type,
        id: config.input.id,
        exclude_id: config.input.exclude_id,
        query: config.input.query,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
        metadata: config.input.metadata,
      })
      yield* api.execute({
        operationId: 'benefits:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.benefits.list(query),
      })
    }),
).pipe(Command.withDescription('List benefits.'))
