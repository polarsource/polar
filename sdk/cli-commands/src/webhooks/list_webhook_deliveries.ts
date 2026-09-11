// Generated from webhooks:list_webhook_deliveries (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput } from '../inputs'

type Query = NonNullable<
  Parameters<Polar['webhooks']['listWebhookDeliveries']>[0]
>

export const command = Command.make(
  'list_webhook_deliveries',
  {
    data,
    input: {
      endpoint_id: Flag.string('endpoint-id')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by webhook endpoint ID.'),
        ),
      start_timestamp: Flag.string('start-timestamp').pipe(
        Flag.optional,
        Flag.withDescription('Filter deliveries after this timestamp.'),
      ),
      end_timestamp: Flag.string('end-timestamp').pipe(
        Flag.optional,
        Flag.withDescription('Filter deliveries before this timestamp.'),
      ),
      succeeded: Flag.boolean('succeeded').pipe(
        Flag.optional,
        Flag.withDescription('Filter by delivery success status.'),
      ),
      query: Flag.string('query').pipe(
        Flag.optional,
        Flag.withDescription('Query to filter webhook deliveries.'),
      ),
      http_code_class: Flag.choice('http-code-class', [
        '2xx',
        '3xx',
        '4xx',
        '5xx',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          'Filter by HTTP response code class (2xx, 3xx, 4xx, 5xx).',
        ),
      ),
      event_type: Flag.choice('event-type', [
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
        .pipe(
          Flag.optional,
          Flag.withDescription('Filter by webhook event type.'),
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
        endpoint_id: config.input.endpoint_id,
        start_timestamp: config.input.start_timestamp,
        end_timestamp: config.input.end_timestamp,
        succeeded: config.input.succeeded,
        query: config.input.query,
        http_code_class: config.input.http_code_class,
        event_type: config.input.event_type,
        page: config.input.page,
        limit: config.input.limit,
      })
      yield* api.execute({
        operationId: 'webhooks:list_webhook_deliveries',
        method: 'GET',
        confirm: false,
        invoke: (client) => client.webhooks.listWebhookDeliveries(query),
      })
    }),
).pipe(Command.withDescription('List webhook deliveries.'))
