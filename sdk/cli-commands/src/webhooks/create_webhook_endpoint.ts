// Generated from webhooks:create_webhook_endpoint (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import { data, mergeInput, missingFlags, nullableStringFlag } from '../inputs'

type Body = NonNullable<
  Parameters<Polar['webhooks']['createWebhookEndpoint']>[0]
>

export const command = Command.make(
  'create_webhook_endpoint',
  {
    data,
    input: {
      url: Flag.String('url').pipe(
        Flag.optional,
        Flag.withDescription(
          'Required. The URL where the webhook events will be sent.',
        ),
      ),
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription(
          'An optional name for the webhook endpoint to help organize and identify it.',
        ),
      ),
      api_version: Flag.Literals('api-version', ['2026-04', '2026-10']).pipe(
        Flag.optional,
        Flag.withDescription(
          "The API version that'll be used in event payloads.",
        ),
      ),
      format: Flag.Literals('format', ['raw', 'discord', 'slack']).pipe(
        Flag.optional,
        Flag.withDescription('Required. The format of the webhook payload.'),
      ),
      events: Flag.Literals('events', [
        'checkout.created',
        'checkout.updated',
        'checkout.expired',
        'customer.created',
        'customer.updated',
        'customer.deleted',
        'customer.state_changed',
        'customer_seat.assigned',
        'customer_seat.claimed',
        'customer_seat.revoked',
        'member.created',
        'member.updated',
        'member.deleted',
        'order.created',
        'order.updated',
        'order.paid',
        'order.refunded',
        'subscription.created',
        'subscription.updated',
        'subscription.active',
        'subscription.canceled',
        'subscription.uncanceled',
        'subscription.cycled',
        'subscription.revoked',
        'subscription.past_due',
        'subscription.paused',
        'subscription.resumed',
        'subscription.migrated',
        'refund.created',
        'refund.updated',
        'product.created',
        'product.updated',
        'discount.created',
        'discount.updated',
        'discount.deleted',
        'benefit.created',
        'benefit.updated',
        'benefit_grant.created',
        'benefit_grant.cycled',
        'benefit_grant.updated',
        'benefit_grant.revoked',
        'organization.updated',
      ])
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Required. The events that will trigger the webhook.',
          ),
        ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The organization ID associated with the webhook endpoint. Defaults to the active organization.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const { organization_id: organizationId, ...body } = mergeInput<Body>(
        config.data,
        {
          url: config.input.url,
          name: config.input.name,
          api_version: config.input.api_version,
          format: config.input.format,
          events: config.input.events,
          organization_id: config.input.organization_id,
        },
      )
      const missing = missingFlags(body, ['url', 'format', 'events'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar webhooks create_webhook_endpoint --url https://webhook.site/cb791d80-f26e-4f8c-be88-6e56054192b0 --format raw --events checkout.created',
        })
      }
      yield* api.execute({
        operationId: 'webhooks:create_webhook_endpoint',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        invoke: (client) => client.webhooks.createWebhookEndpoint(body),
      })
    }),
).pipe(Command.withDescription('Create a webhook endpoint.'))
