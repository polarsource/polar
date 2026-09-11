// Generated from organizations:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['organizations']['list']>[0]>

export const command = Command.make(
  'list',
  {
    data,
    input: {
      slug: Flag.string('slug').pipe(
        Flag.optional,
        Flag.withDescription('Filter by slug.'),
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
        'slug',
        '-slug',
        'name',
        '-name',
        'next_review_threshold',
        '-next_review_threshold',
        'days_in_status',
        '-days_in_status',
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
        slug: config.input.slug,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'organizations:list',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.organizations.list(query),
      })
    }),
).pipe(Command.withDescription('List organizations.'))
