// Generated from custom-fields:list (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<Parameters<Polar['customFields']['list']>[0]>

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
          Flag.withDescription('Filter by organization ID.'),
        ),
      query: Flag.String('query').pipe(
        Flag.optional,
        Flag.withDescription('Filter by custom field name or slug.'),
      ),
      type: Flag.Literals('type', [
        'text',
        'number',
        'date',
        'checkbox',
        'select',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by custom field type.'),
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
        'slug',
        '-slug',
        'name',
        '-name',
        'type',
        '-type',
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
        type: config.input.type,
        page: config.input.page,
        limit: config.input.limit,
        sorting: config.input.sorting,
      })
      yield* api.execute({
        operationId: 'custom-fields:list',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        invoke: (client, organizationId) =>
          client.customFields.list({
            organization_id: organizationId,
            ...query,
          }),
      })
    }),
).pipe(Command.withDescription('List custom fields.'))
