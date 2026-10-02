// Generated from products:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  data,
  mergeInput,
  missingFlags,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['products']['create']>[0]>

export const command = Command.make(
  'create',
  {
    data,
    input: {
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      name: Flag.String('name').pipe(
        Flag.optional,
        Flag.withDescription('Required. The name of the product.'),
      ),
      description: nullableStringFlag('description').pipe(
        Flag.optional,
        Flag.withDescription('The description of the product.'),
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
          'Required. List of available prices for this product. It may combine at most one fixed price with one seat-based price (billed as `fixed + seat_charge`), or contain a single custom or free price, plus any number of metered prices. A free price cannot be combined with other prices, and a custom price cannot be combined with a fixed or seat-based price. Metered prices are not supported on one-time purchase products. JSON: array of ({"amount_type": "fixed", "price_amount": integer, ...} | {"amount_type": "custom", ...} | {"amount_type": "seat_based", "seat_tiers": {"tiers": array of {...}, ...}, ...} | {"amount_type": "unit_based", "tiers": {"type": "volume" | "graduated", "tiers": array of {...}}, ...} | {"amount_type": "metered_unit", "meter_id": string, "unit_amount": number | string, ...} | {"amount_type": "metered_tiers", "meter_id": string, "tiers": {"type": "volume" | "graduated", "tiers": array of {...}}, ...})',
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
          'List of custom fields to attach. JSON: array of {"custom_field_id": string, "required": boolean}',
        ),
      ),
      organization_id: nullableStringFlag('organization-id').pipe(
        Flag.withAlias('org'),
        Flag.optional,
        Flag.withDescription(
          'The ID of the organization owning the product. Defaults to the active organization.',
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
        Flag.withDescription('The recurring interval of the product.'),
      ),
      recurring_interval_count: Flag.Int('recurring-interval-count').pipe(
        Flag.optional,
        Flag.withDescription(
          'Number of interval units of the subscription. If this is set to 1 the charge will happen every interval (e.g. every month), if set to 2 it will be every other month, and so on.',
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
          "Optional meter cycle, independent of the billing interval. When set, overage settlement, meter resets and meter-credit grants run on this cadence rather than the billing interval \u2014 e.g. yearly billing with monthly credits. It must evenly divide the billing interval. If `None`, metered concerns follow the billing interval. Once set, it can't be changed.",
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
      const { organization_id: organizationId, ...body } = mergeInput<Body>(
        config.data,
        {
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
        },
      )
      const missing = missingFlags(body, ['name', 'prices'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar products create --name <name> --prices \'[{"amount_type":"fixed","price_amount":<price_amount>}]\'',
        })
      }
      yield* api.execute({
        operationId: 'products:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        organizationId,
        invoke: (client) => client.products.create(body),
      })
    }),
).pipe(Command.withDescription('Create a product.'))
