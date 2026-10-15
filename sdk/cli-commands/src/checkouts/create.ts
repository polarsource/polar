// Generated from checkouts:create (2026-10). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-10'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/cli'
import { ApiRuntime, ApiCommandError } from '../runtime'
import {
  fields,
  data,
  mergeInput,
  missingFlags,
  jsonFlag,
  nullableStringFlag,
} from '../inputs'

type Body = NonNullable<Parameters<Polar['checkouts']['create']>[0]>

export const command = Command.make(
  'create',
  {
    fields,
    data,
    input: {
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
      metadata: jsonFlag('metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      custom_field_data: jsonFlag('custom-field-data').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object storing custom field values. JSON: {"<key>": string | integer | boolean | null}',
        ),
      ),
      discount_id: nullableStringFlag('discount-id').pipe(
        Flag.optional,
        Flag.withDescription('ID of the discount to apply to the checkout.'),
      ),
      allow_discount_codes: Flag.Boolean('allow-discount-codes').pipe(
        Flag.optional,
        Flag.withDescription(
          "Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.",
        ),
      ),
      require_billing_address: Flag.Boolean('require-billing-address').pipe(
        Flag.optional,
        Flag.withDescription(
          'Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting. If you preset the billing address, this setting will be automatically set to `true`.',
        ),
      ),
      amount: Flag.Int('amount').pipe(
        Flag.optional,
        Flag.withDescription('amount'),
      ),
      seats: Flag.Int('seats').pipe(
        Flag.optional,
        Flag.withDescription(
          'Predefined number of seats (works with seat-based pricing only)',
        ),
      ),
      min_seats: Flag.Int('min-seats').pipe(
        Flag.optional,
        Flag.withDescription(
          'Minimum number of seats (works with seat-based pricing only)',
        ),
      ),
      max_seats: Flag.Int('max-seats').pipe(
        Flag.optional,
        Flag.withDescription(
          'Maximum number of seats (works with seat-based pricing only)',
        ),
      ),
      units: Flag.Int('units').pipe(
        Flag.optional,
        Flag.withDescription(
          'Predefined number of units (works with unit-based pricing only)',
        ),
      ),
      min_units: Flag.Int('min-units').pipe(
        Flag.optional,
        Flag.withDescription(
          'Minimum number of units (works with unit-based pricing only)',
        ),
      ),
      max_units: Flag.Int('max-units').pipe(
        Flag.optional,
        Flag.withDescription(
          'Maximum number of units (works with unit-based pricing only)',
        ),
      ),
      allow_trial: Flag.Boolean('allow-trial').pipe(
        Flag.optional,
        Flag.withDescription(
          'Whether to enable the trial period for the checkout session. If `false`, the trial period will be disabled, even if the selected product has a trial configured.',
        ),
      ),
      customer_id: nullableStringFlag('customer-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'ID of an existing customer in the organization. The customer data will be pre-filled in the checkout form. The resulting order will be linked to this customer.',
        ),
      ),
      is_business_customer: Flag.Boolean('is-business-customer').pipe(
        Flag.optional,
        Flag.withDescription(
          'Whether the customer is a business or an individual. If `true`, the customer will be required to fill their full billing address and billing name.',
        ),
      ),
      external_customer_id: nullableStringFlag('external-customer-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'ID of the customer in your system. If a matching customer exists on Polar, the resulting order will be linked to this customer. Otherwise, a new customer will be created with this external ID set.',
        ),
      ),
      customer_name: nullableStringFlag('customer-name').pipe(
        Flag.optional,
        Flag.withDescription('customer_name'),
      ),
      customer_email: nullableStringFlag('customer-email').pipe(
        Flag.optional,
        Flag.withDescription('customer_email'),
      ),
      customer_ip_address: nullableStringFlag('customer-ip-address').pipe(
        Flag.optional,
        Flag.withDescription('customer_ip_address'),
      ),
      customer_billing_name: nullableStringFlag('customer-billing-name').pipe(
        Flag.optional,
        Flag.withDescription('customer_billing_name'),
      ),
      customer_billing_address: jsonFlag('customer-billing-address').pipe(
        Flag.optional,
        Flag.withDescription(
          'customer_billing_address JSON: {"country": "AD" | "AE" | "AF" | "AG" | "AI" | ..., ...}',
        ),
      ),
      customer_tax_id: nullableStringFlag('customer-tax-id').pipe(
        Flag.optional,
        Flag.withDescription('customer_tax_id'),
      ),
      customer_metadata: jsonFlag('customer-metadata').pipe(
        Flag.optional,
        Flag.withDescription(
          'Key-value object allowing you to store additional information that\'ll be copied to the created customer. JSON: {"<key>": string | integer | number | boolean}',
        ),
      ),
      subscription_id: nullableStringFlag('subscription-id').pipe(
        Flag.optional,
        Flag.withDescription(
          'ID of a subscription to upgrade. It must be on a free pricing. If checkout is successful, metadata set on this checkout will be copied to the subscription, and existing keys will be overwritten.',
        ),
      ),
      success_url: nullableStringFlag('success-url').pipe(
        Flag.optional,
        Flag.withDescription(
          'URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.',
        ),
      ),
      return_url: nullableStringFlag('return-url').pipe(
        Flag.optional,
        Flag.withDescription(
          'When set, a back button will be shown in the checkout to return to this URL.',
        ),
      ),
      embed_origin: nullableStringFlag('embed-origin').pipe(
        Flag.optional,
        Flag.withDescription(
          "If you plan to embed the checkout session, set this to the Origin of the embedding page. It'll allow the Polar iframe to communicate with the parent page.",
        ),
      ),
      locale: nullableStringFlag('locale').pipe(
        Flag.optional,
        Flag.withDescription('locale'),
      ),
      currency: Flag.Literals('currency', [
        'aed',
        'all',
        'amd',
        'aoa',
        'ars',
        'aud',
        'awg',
        'azn',
        'bam',
        'bbd',
        'bdt',
        'bif',
        'bmd',
        'bnd',
        'bob',
        'brl',
        'bsd',
        'bwp',
        'bzd',
        'cad',
        'cdf',
        'chf',
        'clp',
        'cny',
        'cop',
        'crc',
        'cve',
        'czk',
        'djf',
        'dkk',
        'dop',
        'dzd',
        'egp',
        'etb',
        'eur',
        'fjd',
        'fkp',
        'gbp',
        'gel',
        'gip',
        'gmd',
        'gnf',
        'gtq',
        'gyd',
        'hkd',
        'hnl',
        'htg',
        'huf',
        'idr',
        'ils',
        'inr',
        'isk',
        'jmd',
        'jpy',
        'kes',
        'kgs',
        'khr',
        'kmf',
        'krw',
        'kyd',
        'kzt',
        'lak',
        'lkr',
        'lrd',
        'lsl',
        'mad',
        'mdl',
        'mga',
        'mkd',
        'mnt',
        'mop',
        'mur',
        'mvr',
        'mwk',
        'mxn',
        'myr',
        'mzn',
        'nad',
        'ngn',
        'nio',
        'nok',
        'npr',
        'nzd',
        'pab',
        'pen',
        'pgk',
        'php',
        'pkr',
        'pln',
        'pyg',
        'qar',
        'ron',
        'rsd',
        'rwf',
        'sar',
        'sbd',
        'scr',
        'sek',
        'sgd',
        'shp',
        'sos',
        'srd',
        'szl',
        'thb',
        'tjs',
        'top',
        'try',
        'ttd',
        'twd',
        'tzs',
        'uah',
        'ugx',
        'usd',
        'uyu',
        'uzs',
        'vnd',
        'vuv',
        'wst',
        'xaf',
        'xcd',
        'xcg',
        'xof',
        'xpf',
        'yer',
        'zar',
        'zmw',
      ]).pipe(Flag.optional, Flag.withDescription('currency')),
      products: Flag.String('products')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'Required. List of product IDs available to select at that checkout. The first one will be selected by default.',
          ),
        ),
      prices: jsonFlag('prices').pipe(
        Flag.optional,
        Flag.withDescription(
          'Optional mapping of product IDs to a list of ad-hoc prices to create for that product. If not set, catalog prices of the product will be used. JSON: {"<key>": array of ({"amount_type": "fixed", "price_amount": integer, ...} | {"amount_type": "custom", ...} | {"amount_type": "seat_based", "seat_tiers": {...}, ...} | {"amount_type": "unit_based", "tiers": {...}, ...} | {"amount_type": "metered_unit", "meter_id": string, "unit_amount": number | string, ...} | {"amount_type": "metered_tiers", "meter_id": string, "tiers": {...}, ...})}',
        ),
      ),
    },
  },
  (config) =>
    Effect.gen(function* () {
      const api = yield* ApiRuntime
      const body = mergeInput<Body>(config.data, {
        trial_interval: config.input.trial_interval,
        trial_interval_count: config.input.trial_interval_count,
        metadata: config.input.metadata,
        custom_field_data: config.input.custom_field_data,
        discount_id: config.input.discount_id,
        allow_discount_codes: config.input.allow_discount_codes,
        require_billing_address: config.input.require_billing_address,
        amount: config.input.amount,
        seats: config.input.seats,
        min_seats: config.input.min_seats,
        max_seats: config.input.max_seats,
        units: config.input.units,
        min_units: config.input.min_units,
        max_units: config.input.max_units,
        allow_trial: config.input.allow_trial,
        customer_id: config.input.customer_id,
        is_business_customer: config.input.is_business_customer,
        external_customer_id: config.input.external_customer_id,
        customer_name: config.input.customer_name,
        customer_email: config.input.customer_email,
        customer_ip_address: config.input.customer_ip_address,
        customer_billing_name: config.input.customer_billing_name,
        customer_billing_address: config.input.customer_billing_address,
        customer_tax_id: config.input.customer_tax_id,
        customer_metadata: config.input.customer_metadata,
        subscription_id: config.input.subscription_id,
        success_url: config.input.success_url,
        return_url: config.input.return_url,
        embed_origin: config.input.embed_origin,
        locale: config.input.locale,
        currency: config.input.currency,
        products: config.input.products,
        prices: config.input.prices,
      })
      const missing = missingFlags(body, ['products'])
      if (missing.length > 0) {
        return yield* new ApiCommandError({
          message: `Missing required ${missing.length > 1 ? 'flags' : 'flag'} ${missing.join(', ')}`,
          hint: 'Example: polar checkouts create --products <products>',
        })
      }
      yield* api.execute({
        operationId: 'checkouts:create',
        method: 'POST',
        requiresConfirmation: false,
        confirm: false,
        fields: config.fields,
        invoke: (client) => client.checkouts.create(body),
      })
    }),
).pipe(Command.withDescription('Create a checkout session.'))
