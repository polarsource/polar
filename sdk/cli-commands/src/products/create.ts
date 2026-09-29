// Generated from products:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['products']['create']>[0]>

export const command = Command.make(
  'create',
  {
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information.',
        ),
      ),
      name: Flag.String('name').pipe(
        Flag.optional,
        Flag.withDescription('The name of the product.'),
      ),
      description: Flag.String('description').pipe(
        Flag.optional,
        Flag.withDescription('The description of the product.'),
      ),
      visibility: Flag.Literals('visibility', [
        'draft',
        'private',
        'public',
      ]).pipe(Flag.optional, Flag.withDescription('visibility')),
      prices: jsonFlag('prices').pipe(
        Flag.optional,
        Flag.withDescription(
          'List of available prices for this product. It may combine at most one fixed price with one seat-based price (billed as `fixed + seat_charge`), or contain a single custom or free price, plus any number of metered prices. A free price cannot be combined with other prices, and a custom price cannot be combined with a fixed or seat-based price. Metered prices are not supported on one-time purchase products.',
        ),
      ),
      medias: Flag.String('medias')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded.',
          ),
        ),
      attached_custom_fields: jsonFlag('attached-custom-fields').pipe(
        Flag.optional,
        Flag.withDescription('List of custom fields to attach.'),
      ),
      organization_id: Flag.String('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the product. **Required unless you use an organization token.**',
        ),
      ),
      trial_interval: Flag.Literals('trial-interval', [
        'day',
        'week',
        'month',
        'year',
      ]).pipe(
        Flag.optional,
        Flag.withDescription('The interval unit for the trial period.'),
      ),
      trial_interval_count: Flag.Int('trial-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          'The number of interval units for the trial period.',
        ),
      ),
      recurring_interval: Flag.Literals('recurring-interval', [
        'day',
        'week',
        'month',
        'year',
      ]).pipe(
        Flag.optional,
        Flag.withDescription('States that the product is a one-time purchase.'),
      ),
      recurring_interval_count: Flag.Int('recurring-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          "One-time products don't have a recurring interval count.",
        ),
      ),
      meter_interval: Flag.Literals('meter-interval', [
        'day',
        'week',
        'month',
        'year',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          "Optional meter cycle, independent of the billing interval. When set, overage settlement, meter resets and meter-credit grants run on this cadence rather than the billing interval \u2014 e.g. yearly billing with monthly credits. It must evenly divide the billing interval. If `None`, metered concerns follow the billing interval. **Once set, it can't be changed.**",
        ),
      ),
      meter_interval_count: Flag.Int('meter-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          'Number of meter interval units. Defaults to 1 when `meter_interval` is set. Ignored when `meter_interval` is `None`.',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        name: config.input.name,
        description: config.input.description,
        visibility: config.input.visibility,
        prices: config.input.prices,
        medias: config.input.medias,
        attached_custom_fields: config.input.attached_custom_fields,
        organization_id: config.input.organization_id,
        trial_interval: config.input.trial_interval,
        trial_interval_count: config.input.trial_interval_count,
        recurring_interval: config.input.recurring_interval,
        recurring_interval_count: config.input.recurring_interval_count,
        meter_interval: config.input.meter_interval,
        meter_interval_count: config.input.meter_interval_count,
      })
      yield* api.execute({
        operationId: 'products:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId: body.organization_id,
        invoke: (client, organizationId) =>
          client.products.create({ organization_id: organizationId, ...body }),
      })
    }),
).pipe(Command.withDescription('Create a product.'))
