// Generated from license_keys:list (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['licenseKeys']['list']>[0]>

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
      benefit_id: Flag.string('benefit-id')
        .pipe(Flag.atLeast(1))
        .pipe(Flag.optional, Flag.withDescription('Filter by benefit ID.')),
      status: Flag.choice('status', ['granted', 'revoked', 'disabled'])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by license key status.'),
        ),
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
        organization_id: config.input.organization_id,
        benefit_id: config.input.benefit_id,
        status: config.input.status,
        page: config.input.page,
        limit: config.input.limit,
      })
      yield* api.execute({
        operationId: 'license_keys:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) => client.licenseKeys.list(query),
      })
    }),
).pipe(
  Command.withDescription(
    'Get license keys connected to the given organization & filters.',
  ),
)
