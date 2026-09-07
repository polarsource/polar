import {
  clientUpdateCheckouts,
  createCheckouts,
} from '@polar-sh/sdk/2026-04/services/checkouts'
import { createPolarCore, type Environment } from '@polar-sh/sdk/2026-04'
import { createError, getValidatedQuery, sendRedirect } from 'h3'
import type { H3Event } from 'h3'
import { z } from 'zod'

export interface CheckoutConfig {
  accessToken: string
  successUrl?: string
  returnUrl?: string
  includeCheckoutId?: boolean
  environment?: Environment
  theme?: 'light' | 'dark'
}

const checkoutQuerySchema = z.object({
  products: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.string().array()),
  customer_id: z.string().nonempty().optional(),
  external_customer_id: z.string().nonempty().optional(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().nonempty().optional(),
  customer_billing_address: z.string().nonempty().optional(),
  customer_tax_id: z.string().nonempty().optional(),
  customer_ip_address: z.string().nonempty().optional(),
  customer_metadata: z.string().nonempty().optional(),
  allow_discount_codes: z
    .string()
    .toLowerCase()
    .transform((x) => x === 'true')
    .pipe(z.boolean())
    .optional(),
  discount_id: z.string().nonempty().optional(),
  discount_code: z.string().optional(),
  metadata: z.string().nonempty().optional(),
  seats: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .optional(),
})

export const Checkout = ({
  accessToken,
  successUrl,
  returnUrl,
  environment,
  theme,
  includeCheckoutId = true,
}: CheckoutConfig) => {
  const polar = createPolarCore({ accessToken, environment })

  return async (event: H3Event) => {
    const {
      products,
      customer_id: customerId,
      external_customer_id: customerExternalId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_billing_address: customerBillingAddress,
      customer_tax_id: customerTaxId,
      customer_ip_address: customerIpAddress,
      customer_metadata: customerMetadata,
      allow_discount_codes: allowDiscountCodes,
      discount_id: discountId,
      discount_code: discountCode,
      metadata,
      seats,
    } = await getValidatedQuery(event, checkoutQuerySchema.parse)

    try {
      const success = successUrl ? new URL(successUrl) : undefined

      if (success && includeCheckoutId) {
        success.searchParams.set('checkout_id', '{CHECKOUT_ID}')
      }

      const retUrl = returnUrl ? new URL(returnUrl) : undefined

      const result = await createCheckouts(polar)({
        products,
        success_url: success
          ? success.toString().replaceAll('%7BCHECKOUT_ID%7D', '{CHECKOUT_ID}')
          : undefined,
        customer_id: customerId,
        external_customer_id: customerExternalId,
        customer_email: customerEmail,
        customer_name: customerName,
        customer_billing_address: customerBillingAddress
          ? JSON.parse(customerBillingAddress)
          : undefined,
        customer_tax_id: customerTaxId,
        customer_ip_address: customerIpAddress,
        customer_metadata: customerMetadata
          ? JSON.parse(customerMetadata)
          : undefined,
        allow_discount_codes: allowDiscountCodes,
        discount_id: discountId,
        metadata: metadata ? JSON.parse(metadata) : undefined,
        seats,
        return_url: retUrl
          ? retUrl.toString().replaceAll('%7BCHECKOUT_ID%7D', '{CHECKOUT_ID}')
          : undefined,
      })

      if (discountCode && !discountId) {
        await clientUpdateCheckouts(polar)(result.client_secret, {
          discount_code: discountCode,
        })
      }

      const redirectUrl = new URL(result.url)

      if (theme) {
        redirectUrl.searchParams.set('theme', theme)
      }

      return sendRedirect(event, redirectUrl.toString())
    } catch (error) {
      console.error('Failed to checkout:', error)
      throw createError({
        statusCode: 500,
        statusMessage: (error as Error).message,
        message: (error as Error).message ?? 'Internal server error',
      })
    }
  }
}
