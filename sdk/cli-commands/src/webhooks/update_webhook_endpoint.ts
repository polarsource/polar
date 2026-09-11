// Generated from webhooks:update_webhook_endpoint (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Body = NonNullable<
  Parameters<Polar['webhooks']['updateWebhookEndpoint']>[1]
>

export const command = Command.make(
  'update_webhook_endpoint',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      url: Flag.string('url').pipe(Flag.optional, Flag.withDescription('url')),
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription(
          'An optional name for the webhook endpoint to help organize and identify it.',
        ),
      ),
      api_version: Flag.choice('api-version', ['2026-04', '2026-10']).pipe(
        Flag.optional,
        Flag.withDescription(
          "The API version that'll be used in event payloads.",
        ),
      ),
      format: Flag.choice('format', ['raw', 'discord', 'slack']).pipe(
        Flag.optional,
        Flag.withDescription('format'),
      ),
      events: Flag.choice('events', [
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
        .pipe(Flag.optional, Flag.withDescription('events')),
      enabled: Flag.boolean('enabled').pipe(
        Flag.optional,
        Flag.withDescription('Whether the webhook endpoint is enabled.'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        url: config.input.url,
        name: config.input.name,
        api_version: config.input.api_version,
        format: config.input.format,
        events: config.input.events,
        enabled: config.input.enabled,
      })
      yield* api.execute({
        operationId: 'webhooks:update_webhook_endpoint',
        method: 'PATCH',
        requiresConfirmation: false,
        confirm: false,
        invoke: (client) =>
          client.webhooks.updateWebhookEndpoint(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a webhook endpoint.'))
