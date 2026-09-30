// Generated from products:update (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect, Schema } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  confirm,
  data,
  mergeInput,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['products']['update']>[1]>

export const command = Command.make(
  'update',
  {
    confirm,
    path: {
      id: Argument.String('id'),
    },
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
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
      name: nullableStringFlag('name').pipe(
        Flag.optional,
        Flag.withDescription('name'),
      ),
      description: nullableStringFlag('description').pipe(
        Flag.optional,
        Flag.withDescription('The description of the product.'),
      ),
      recurring_interval: Flag.Literals('recurring-interval', [
        'day',
        'week',
        'month',
        'year',
      ]).pipe(
        Flag.optional,
        Flag.withDescription(
          "The recurring interval of the product. If `None`, the product is a one-time purchase. Can only be set on legacy recurring products. Once set, it can't be changed.",
        ),
      ),
      recurring_interval_count: Flag.Int('recurring-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          "Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on. Once set, it can't be changed.",
        ),
      ),
      is_archived: Flag.Boolean('is-archived').pipe(
        Flag.optional,
        Flag.withDescription(
          "Whether the product is archived. If `true`, the product won't be available for purchase anymore. Existing customers will still have access to their benefits, and subscriptions will continue normally.",
        ),
      ),
      visibility: Flag.Literals('visibility', [
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
          'List of available prices for this product. If you want to keep existing prices, include them in the list as an `ExistingProductPrice` object. JSON: array of ({"id": string} | {"amount_type": "fixed", "price_amount": integer, ...} | {"amount_type": "custom", ...} | {"amount_type": "seat_based", "seat_tiers": {"tiers": array of {...}, ...}, ...} | {"amount_type": "unit_based", "tiers": {"type": "volume" | "graduated", "tiers": array of {...}}, ...} | {"amount_type": "metered_unit", "meter_id": string, "unit_amount": number | string, ...} | {"amount_type": "metered_tiers", "meter_id": string, "tiers": {"type": "volume" | "graduated", "tiers": array of {...}}, ...})',
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
        Flag.withDescription(
          'attached_custom_fields JSON: array of {"custom_field_id": string, "required": boolean}',
        ),
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
      const confirmationInput = yield* Schema.decodeUnknownEffect(
        Schema.Struct({
          is_archived: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
        }),
      )(body).pipe(
        Effect.mapError(
          (error) => new ApiCommandError({ message: error.message }),
        ),
      )
      yield* api.execute({
        operationId: 'products:update',
        method: 'PATCH',
        requiresConfirmation: confirmationInput['is_archived'] === true,
        confirm: config.confirm,
        preview: {
          fields: [
            { key: 'id', label: 'ID' },
            { key: 'name', label: 'Name' },
            { key: 'is_archived', label: 'Archived' },
          ],
          invoke: (client) => client.products.get(config.path.id),
        },
        invoke: (client) => client.products.update(config.path.id, body),
      })
    }),
).pipe(Command.withDescription('Update a product.'))
