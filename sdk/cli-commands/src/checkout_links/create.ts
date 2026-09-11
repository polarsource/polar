// Generated from checkout-links:create (2026-04). Do not edit.
import type { Polar } from '@polar-sh/sdk/2026-04'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { ApiRuntime } from '../runtime'
import { data, mergeInput, jsonFlag } from '../inputs'

type Body = NonNullable<Parameters<Polar['checkoutLinks']['create']>[0]>

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
      payment_processor: Flag.choice('payment-processor', ['stripe']).pipe(
        Flag.optional,
        Flag.withDescription(
          'Payment processor to use. Currently only Stripe is supported.',
        ),
      ),
      label: Flag.string('label').pipe(
        Flag.optional,
        Flag.withDescription('Optional label to distinguish links internally'),
      ),
      allow_discount_codes: Flag.boolean('allow-discount-codes').pipe(
        Flag.optional,
        Flag.withDescription(
          "Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.",
        ),
      ),
      require_billing_address: Flag.boolean('require-billing-address').pipe(
        Flag.optional,
        Flag.withDescription(
          'Whether to require the customer to fill their full billing address, instead of just the country. Customers in the US will always be required to fill their full address, regardless of this setting.',
        ),
      ),
      discount_id: Flag.string('discount-id').pipe(
        Flag.optional,
        Flag.withDescription(
          "ID of the discount to apply to the checkout. If the discount is not applicable anymore when opening the checkout link, it'll be ignored.",
        ),
      ),
      seats: Flag.integer('seats').pipe(
        Flag.optional,
        Flag.withDescription(
          "Preconfigured number of seats for seat-based pricing. When set, checkout sessions created from this link are locked to this number of seats and the customer won't be able to change it. All products on the link must use seat-based pricing and allow this number of seats. If the products no longer accommodate this value when the link is opened, it'll be ignored.",
        ),
      ),
      units: Flag.integer('units').pipe(
        Flag.optional,
        Flag.withDescription(
          "Preconfigured number of units for unit-based pricing. When set, checkout sessions created from this link are locked to this number of units and the customer won't be able to change it. All products on the link must use unit-based pricing and allow this number of units. If the products no longer accommodate this value when the link is opened, it'll be ignored.",
        ),
      ),
      success_url: Flag.string('success-url').pipe(
        Flag.optional,
        Flag.withDescription(
          'URL where the customer will be redirected after a successful payment.You can add the `checkout_id={CHECKOUT_ID}` query parameter to retrieve the checkout session id.',
        ),
      ),
      return_url: Flag.string('return-url').pipe(
        Flag.optional,
        Flag.withDescription(
          'When set, a back button will be shown in the checkout to return to this URL.',
        ),
      ),
      product_price_id: Flag.string('product-price-id').pipe(
        Flag.optional,
        Flag.withDescription('product_price_id'),
      ),
      product_id: Flag.string('product-id').pipe(
        Flag.optional,
        Flag.withDescription('product_id'),
      ),
      products: Flag.string('products')
        .pipe(Flag.atLeast(1))
        .pipe(
          Flag.optional,
          Flag.withDescription(
            'List of products that will be available to select at checkout.',
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
        payment_processor: config.input.payment_processor,
        label: config.input.label,
        allow_discount_codes: config.input.allow_discount_codes,
        require_billing_address: config.input.require_billing_address,
        discount_id: config.input.discount_id,
        seats: config.input.seats,
        units: config.input.units,
        success_url: config.input.success_url,
        return_url: config.input.return_url,
        product_price_id: config.input.product_price_id,
        product_id: config.input.product_id,
        products: config.input.products,
      })
      yield* api.execute({
        operationId: 'checkout-links:create',
        method: 'POST',
        confirm: false,
        invoke: (client) => client.checkoutLinks.create(body),
      })
    }),
).pipe(Command.withDescription('Create a checkout link.'))
