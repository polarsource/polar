// Generated from webhooks:list_webhook_endpoints (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<
  Parameters<Polar['webhooks']['listWebhookEndpoints']>[0]
>

export const command = Command.make(
  'list_webhook_endpoints',
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
      page: Flag.Int('page').pipe(
        Flag.optional,
        Flag.withDescription('Page number, defaults to 1.'),
      ),
      limit: Flag.Int('limit').pipe(
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
        page: config.input.page,
        limit: config.input.limit,
      })
      yield* api.execute({
        operationId: 'webhooks:list_webhook_endpoints',
        method: 'GET',
        requiresConfirmation: false,
        confirm: false,
        organizationId: query.organization_id,
        invoke: (client) => client.webhooks.listWebhookEndpoints(query),
      })
    }),
).pipe(Command.withDescription('List webhook endpoints.'))
