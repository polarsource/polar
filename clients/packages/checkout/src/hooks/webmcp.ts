import type { schemas } from '@polar-sh/client'
import { useEffect, useRef } from 'react'
import type { FieldErrors, UseFormReturn } from 'react-hook-form'
import {
  COUNTRIES_WITH_FIXED_STATE_OPTIONS,
  FIXED_STATE_OPTIONS,
} from '../components/ui/CountryStatePicker'
import { hasProductCheckout } from '../guards'
import { isRequiredField } from '../utils/address'

interface ModelContextTool {
  name: string
  description: string
  inputSchema: object
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean }
  execute: (input: Record<string, unknown>) => Promise<string>
}

interface ModelContext {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => unknown
}

export type CheckoutSubmitResult =
  | { status: 'confirmed' }
  | { status: 'invalid'; errors: Record<string, string> }
  | { status: 'failed'; message: string }

interface CheckoutWebMCPOptions {
  enabled: boolean
  checkout: schemas['CheckoutPublic']
  form: UseFormReturn<schemas['CheckoutUpdatePublic']>
  update: (
    data: schemas['CheckoutUpdatePublic'],
  ) => Promise<schemas['CheckoutPublic']>
  submit: () => Promise<CheckoutSubmitResult>
  focusPaymentForm?: (options: { clear: boolean }) => boolean
  isPaymentFormReady: boolean
  isPaymentFormComplete: boolean
}

type AddressField = keyof schemas['AddressInput']

const ADDRESS_FIELDS: AddressField[] = [
  'line1',
  'line2',
  'postal_code',
  'city',
  'state',
]

const PAYMENT_INSTRUCTIONS =
  'Card details live in the Stripe payment form, a cross-origin iframe that no tool can fill: they must be typed. ' +
  'Call focus_card_number, then, digits only: type the card number, press Tab, type the expiry as MMYY, press Tab, type the CVC. ' +
  'Focus does not move between the card fields by itself. ' +
  'Then check payment.card_complete with get_checkout_state. If it is false, call focus_card_number with clear: true and repeat.'

const getModelContext = (): ModelContext | undefined => {
  if (typeof document === 'undefined') {
    return undefined
  }
  return (
    (document as Document & { modelContext?: ModelContext }).modelContext ??
    (navigator as Navigator & { modelContext?: ModelContext }).modelContext
  )
}

export const flattenFormErrors = (
  errors: FieldErrors,
  prefix = '',
): Record<string, string> => {
  const flattened: Record<string, string> = {}
  for (const [key, error] of Object.entries(errors)) {
    if (!error || key === 'ref') {
      continue
    }
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof error.message === 'string' && error.message) {
      flattened[path] = error.message
    } else if (typeof error === 'object') {
      Object.assign(flattened, flattenFormErrors(error as FieldErrors, path))
    }
  }
  return flattened
}

export const normalizeState = (
  country: string,
  state: string | null | undefined,
): string | null | undefined => {
  if (!state || !COUNTRIES_WITH_FIXED_STATE_OPTIONS.includes(country)) {
    return state
  }
  const options = FIXED_STATE_OPTIONS[country] ?? {}
  const wanted = state.trim().toLowerCase()
  const match = Object.entries(options).find(
    ([code, label]) =>
      code.toLowerCase() === wanted ||
      code.toLowerCase() === `${country.toLowerCase()}-${wanted}` ||
      label.toLowerCase() === wanted,
  )
  return match ? match[0] : state
}

export const describePrice = (price: schemas['ProductPrice'] | undefined) => {
  if (!price) {
    return null
  }
  switch (price.amount_type) {
    case 'fixed':
      return { type: 'fixed', amount: price.price_amount }
    case 'custom':
      return {
        type: 'pay_what_you_want',
        minimum: price.minimum_amount,
        maximum: price.maximum_amount,
        preset: price.preset_amount,
      }
    case 'seat_based':
      return {
        type: 'per_seat',
        price_per_seat: Number(price.tiers.tiers[0]?.unit_amount),
      }
    default:
      return { type: price.amount_type }
  }
}

export const findProduct = (
  checkout: schemas['CheckoutPublic'],
  nameOrId: string,
) => {
  const wanted = nameOrId.trim().toLowerCase()
  return checkout.products.find(
    ({ id, name }) => id === nameOrId || name.toLowerCase() === wanted,
  )
}

const describeOrder = (checkout: schemas['CheckoutPublic']) => {
  if (!hasProductCheckout(checkout)) {
    return null
  }
  const priceOf = (productId: string) =>
    describePrice(
      checkout.prices[productId]?.find(
        (price) => price.price_currency === checkout.currency,
      ),
    )
  const { amount_type } = checkout.product_price
  return {
    product: {
      id: checkout.product.id,
      name: checkout.product.name,
      recurring_interval: checkout.product.recurring_interval,
      price: describePrice(checkout.product_price),
    },
    ...(amount_type === 'seat_based' && {
      seats: checkout.seats,
      min_seats: checkout.min_seats,
      max_seats: checkout.max_seats,
    }),
    ...(amount_type === 'custom' && { amount: checkout.amount }),
    discount_code: checkout.discount?.code ?? null,
    accepts_discount_codes:
      checkout.allow_discount_codes && checkout.is_discount_applicable,
    other_products: checkout.products
      .filter((product) => product.id !== checkout.product.id)
      .map((product) => ({
        id: product.id,
        name: product.name,
        recurring_interval: product.recurring_interval,
        price: priceOf(product.id),
      })),
  }
}

const describeCheckout = (
  checkout: schemas['CheckoutPublic'],
  form: UseFormReturn<schemas['CheckoutUpdatePublic']>,
  payment: { ready: boolean; complete: boolean },
) => {
  const address = checkout.customer_billing_address
  const fields = checkout.billing_address_fields
  const missing: string[] = []
  if (!checkout.customer_email) {
    missing.push('email')
  }
  if (checkout.is_payment_form_required && !form.getValues('customer_name')) {
    missing.push('name')
  }
  for (const field of ['country', ...ADDRESS_FIELDS] as const) {
    if (isRequiredField(fields[field]) && !address?.[field]) {
      missing.push(`billing_address.${field}`)
    }
  }
  if (checkout.is_payment_form_required && !payment.complete) {
    missing.push('card_details')
  }

  return JSON.stringify(
    {
      status: checkout.status,
      order: describeOrder(checkout),
      amounts_in_cents: {
        subtotal: checkout.amount,
        discount: checkout.discount_amount,
        tax: checkout.tax_amount,
        total: checkout.total_amount,
        currency: checkout.currency,
      },
      customer: {
        email: checkout.customer_email,
        name: form.getValues('customer_name') || checkout.customer_name,
        billing_address: address,
      },
      billing_address_fields: Object.fromEntries(
        Object.entries(fields).filter(([, mode]) => mode !== 'disabled'),
      ),
      missing_required_fields: missing,
      errors: flattenFormErrors(form.formState.errors),
      payment: checkout.is_payment_form_required
        ? {
            form_ready: payment.ready,
            card_complete: payment.complete,
            instructions: PAYMENT_INSTRUCTIONS,
          }
        : { required: false },
    },
    null,
    2,
  )
}

const errorDetail = (error: unknown) => {
  if (error && typeof error === 'object' && 'detail' in error) {
    return JSON.stringify(error.detail)
  }
  return error instanceof Error ? error.message : String(error)
}

export const useCheckoutWebMCP = (options: CheckoutWebMCPOptions) => {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  const { enabled } = options

  useEffect(() => {
    const modelContext = getModelContext()
    if (!enabled || !modelContext) {
      return
    }

    const describe = (checkout = latest.current.checkout) =>
      describeCheckout(checkout, latest.current.form, {
        ready: latest.current.isPaymentFormReady,
        complete: latest.current.isPaymentFormComplete,
      })

    const tools: ModelContextTool[] = [
      {
        name: 'get_checkout_state',
        description:
          'Get the current state of this checkout: the order (product, price, seats or amount, discount code, other products on offer), amounts, customer details, which billing address fields are required for the selected country, missing required fields, validation errors, and payment form status with instructions for entering card details.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: async () => describe(),
      },
      {
        name: 'set_customer_details',
        description:
          'Fill in the buyer details in one call: email, cardholder name and billing address. Only the given fields change. Returns the updated checkout state, including which billing address fields the selected country requires.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Buyer email address' },
            name: { type: 'string', description: 'Cardholder name' },
            billing_address: {
              type: 'object',
              properties: {
                country: {
                  type: 'string',
                  description: 'ISO 3166-1 alpha-2 country code, e.g. US, DE',
                },
                line1: { type: 'string' },
                line2: { type: 'string' },
                postal_code: { type: 'string' },
                city: { type: 'string' },
                state: {
                  type: 'string',
                  description:
                    'State or province: a code like CA or US-CA, or a name like California',
                },
              },
            },
          },
        },
        execute: async (input) => {
          const { form, update } = latest.current
          const { email, name, billing_address } = input as {
            email?: string
            name?: string
            billing_address?: Partial<Record<AddressField, string>>
          }
          const payload: schemas['CheckoutUpdatePublic'] = {}

          if (email) {
            form.setValue('customer_email', email, { shouldDirty: true })
            payload.customer_email = email
          }
          if (name) {
            form.setValue('customer_name', name, { shouldDirty: true })
            payload.customer_name = name
          }
          if (billing_address) {
            const current = form.getValues('customer_billing_address')
            const country = (
              billing_address.country ?? current?.country
            )?.toUpperCase()
            if (!country) {
              return 'billing_address.country is required to set a billing address.'
            }
            const address = {
              ...current,
              ...billing_address,
              country,
              state: normalizeState(
                country,
                billing_address.state ?? current?.state,
              ),
            } as schemas['AddressInput']
            form.setValue('customer_billing_address.country', address.country, {
              shouldDirty: true,
            })
            for (const field of ADDRESS_FIELDS) {
              if (address[field] !== undefined) {
                form.setValue(
                  `customer_billing_address.${field}`,
                  address[field],
                  { shouldDirty: true },
                )
              }
            }
            payload.customer_billing_address = address
          }

          try {
            const updated = await update(payload)
            form.clearErrors(['customer_email', 'customer_billing_address'])
            return describe(updated)
          } catch (error) {
            return `The update was rejected: ${errorDetail(error)}\n${describe()}`
          }
        },
      },
      {
        name: 'update_order',
        description:
          'Change what is being bought, in one call: switch to another product on offer (by name or ID, see order.other_products in get_checkout_state), set the number of seats of a per-seat product, set the amount of a pay-what-you-want product, or apply a discount code (an empty string removes it). Amounts are in cents. Returns the updated checkout state with the new total, or why the change was rejected.',
        inputSchema: {
          type: 'object',
          properties: {
            product: {
              type: 'string',
              description: 'Name or ID of a product on offer',
            },
            seats: { type: 'integer', minimum: 1 },
            amount_in_cents: { type: 'integer', minimum: 0 },
            discount_code: { type: 'string' },
          },
        },
        execute: async (input) => {
          const { checkout, form, update } = latest.current
          const { product, seats, amount_in_cents, discount_code } = input as {
            product?: string
            seats?: number
            amount_in_cents?: number
            discount_code?: string
          }
          const payload: schemas['CheckoutUpdatePublic'] = {}
          if (product) {
            const match = findProduct(checkout, product)
            if (!match) {
              return `No product "${product}" in this checkout. Products on offer: ${checkout.products.map(({ name }) => name).join(', ')}.`
            }
            payload.product_id = match.id
          }
          if (seats !== undefined) {
            payload.seats = seats
          }
          if (amount_in_cents !== undefined) {
            payload.amount = amount_in_cents
          }
          if (discount_code !== undefined) {
            payload.discount_code = discount_code || null
          }
          if (Object.keys(payload).length === 0) {
            return 'Nothing to change: pass product, seats, amount_in_cents or discount_code.'
          }
          form.clearErrors(['product_id', 'seats', 'amount', 'discount_code'])
          try {
            return describe(await update(payload))
          } catch (error) {
            return `The change was rejected: ${errorDetail(error)}\n${describe()}`
          }
        },
      },
      {
        name: 'focus_card_number',
        description:
          'Put the keyboard focus in the card number field of the Stripe payment form, so the card details can be typed right away. Pass clear: true to empty the card fields first, for example after a typo.',
        inputSchema: {
          type: 'object',
          properties: {
            clear: {
              type: 'boolean',
              description: 'Empty the card fields before focusing',
            },
          },
        },
        execute: async (input) => {
          const { focusPaymentForm, isPaymentFormReady } = latest.current
          if (!focusPaymentForm || !isPaymentFormReady) {
            return 'The payment form is not ready yet. Try again in a moment.'
          }
          focusPaymentForm({ clear: input.clear === true })
          return 'The card number field has focus. Digits only: type the card number, press Tab, type the expiry as MMYY, press Tab, type the CVC. Focus does not move between the card fields by itself.'
        },
      },
      {
        name: 'submit_checkout',
        description:
          'Submit the checkout and pay. Call it once all required fields are set and payment.card_complete is true. Returns "confirmed" once the payment succeeded, or the validation and payment errors to fix. If the call ends with a navigation error instead, the card issuer authentication step started: wait for the page URL to end in /confirmation, which means the purchase is complete.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { consequentialHint: true },
        execute: async () => {
          try {
            const result = await latest.current.submit()
            if (result.status === 'confirmed') {
              return 'confirmed: the payment succeeded and the purchase is complete. The page is navigating to the order confirmation; nothing else needs to be done.'
            }
            return `${JSON.stringify(result, null, 2)}\n${describe()}`
          } catch (error) {
            return `failed: ${errorDetail(error)}\n${describe()}`
          }
        },
      },
    ]

    const controller = new AbortController()
    for (const tool of tools) {
      void Promise.resolve(
        modelContext.registerTool(tool, { signal: controller.signal }),
      ).catch(console.error)
    }
    return () => controller.abort()
  }, [enabled])
}
