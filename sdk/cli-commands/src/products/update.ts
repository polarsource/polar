// Generated from products:update (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['products']['update']>[1]>

export const command = Command.make(
  'update',
  {
    path: {
      id: Argument.string('id'),
    },
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information.',
        ),
      ),
      trial_interval: Flag.choice('trial-interval', [
        'day',
        'week',
        'month',
        'year',
      ]).pipe(
        Flag.optional,
        Flag.withDescription('The interval unit for the trial period.'),
      ),
      trial_interval_count: Flag.integer('trial-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          'The number of interval units for the trial period.',
        ),
      ),
      name: Flag.string('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      description: Flag.string('description').pipe(
        Flag.optional,
        Flag.withDescription('The description of the product.'),
      ),
      recurring_interval: Flag.choice('recurring-interval', [
        'day',
        'week',
        'month',
        'year',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          "The recurring interval of the product. If `None`, the product is a one-time purchase. **Can only be set on legacy recurring products. Once set, it can't be changed.**",
        ),
      ),
      recurring_interval_count: Flag.integer('recurring-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          "Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. Once set, it can't be changed.**",
        ),
      ),
      is_archived: Flag.boolean('is-archived').pipe(
        Flag.optional,
        Flag.withDescription(
          "Whether the product is archived. If `true`, the product won't be available for purchase anymore. Existing customers will still have access to their benefits, and subscriptions will continue normally.",
        ),
      ),
      visibility: Flag.choice('visibility', [
        'draft',
        'private',
        'public',
      ]).pipe(
        Flag.optional,
        Flag.withDescription('The visibility of the product.'),
      ),
      prices: jsonFlag('prices').pipe(
        Flag.optional,
        Flag.withDescription(
          'List of available prices for this product. If you want to keep existing prices, include them in the list as an `ExistingProductPrice` object.',
        ),
      ),
      medias: Flag.string('medias')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'List of file IDs. Each one must be on the same organization as the product, of type `product_media` and correctly uploaded.',
          ),
        ),
      attached_custom_fields: jsonFlag('attached-custom-fields').pipe(
        Flag.optional,
        Flag.withDescription('attached_custom_fields'),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        metadata: config.input.metadata,
        trial_interval: config.input.trial_interval,
        trial_interval_count: config.input.trial_interval_count,
        name: config.input.name,
        description: config.input.description,
        recurring_interval: config.input.recurring_interval,
        recurring_interval_count: config.input.recurring_interval_count,
        is_archived: config.input.is_archived,
        visibility: config.input.visibility,
        prices: config.input.prices,
        medias: config.input.medias,
        attached_custom_fields: config.input.attached_custom_fields,
      })
      yield* api.execute({
        operationId: 'products:update',
        method: 'PATCH',
        confirm: false,
        invoke: (client) => client.products.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a product.'))
