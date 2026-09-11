// Generated from benefits:grants (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['benefits']['grants']>[1]>

export const command = Command.make(
  'grants',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      is_granted: Flag.boolean('is-granted').pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned. ',
        ),
      ),
      customer_id: Flag.string('customer-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by customer.')),
      member_id: Flag.string('member-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by member.')),
      page: Flag.integer('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.integer('limit').pipe(
        Flag.optional,
        Flag.withDescription('Size of a page, defaults to 10. Maximum is 100.'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const query = mergeInput<Query>(config.data, {
        is_granted: config.input.is_granted,
        customer_id: config.input.customer_id,
        member_id: config.input.member_id,
        page: config.input.page,
        limit: config.input.limit,
      })
      yield* api.execute({
        operationId: 'benefits:grants',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.benefits.grants(config.path.id, query),
      })
    }),
).pipe(Command.withDescription('List the individual grants for a benefit.'))
