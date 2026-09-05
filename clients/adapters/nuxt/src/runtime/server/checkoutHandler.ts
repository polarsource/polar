import { createCheckouts } from '@polar-sh/sdk/2026-04/services/checkouts'
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
  customerId: z.string().nonempty().optional(),
  customerExternalId: z.string().nonempty().optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().nonempty().optional(),
  customerBillingAddress: z.string().nonempty().optional(),
  customerTaxId: z.string().nonempty().optional(),
  customerIpAddress: z.string().nonempty().optional(),
  customerMetadata: z.string().nonempty().optional(),
  allowDiscountCodes: z
    .string()
    .toLowerCase()
    .transform((x) => x === 'true')
    .pipe(z.boolean())
    .optional(),
  discountId: z.string().nonempty().optional(),
  metadata: z.string().nonempty().optional(),
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
      customerId,
      customerExternalId,
      customerEmail,
      customerName,
      customerBillingAddress,
      customerTaxId,
      customerIpAddress,
      customerMetadata,
      allowDiscountCodes,
      discountId,
      metadata,
    } = await getValidatedQuery(event, checkoutQuerySchema.parse)

    try {
      const success = successUrl ? new URL(successUrl) : undefined

      if (success && includeCheckoutId) {
        success.searchParams.set('checkoutId', '{CHECKOUT_ID}')
      }

      const retUrl = returnUrl ? new URL(returnUrl) : undefined

      const result = await createCheckouts(polar)({
        products,
        success_url: success ? decodeURI(success.toString()) : undefined,
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
        return_url: retUrl ? decodeURI(retUrl.toString()) : undefined,
      })

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
