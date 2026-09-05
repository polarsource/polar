import { createCheckouts } from '@polar-sh/sdk/2026-04/services/checkouts'
import { createPolarCore, type Environment } from '@polar-sh/sdk/2026-04'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export interface CheckoutConfig {
  accessToken: string
  successUrl?: string
  returnUrl?: string
  includeCheckoutId?: boolean
  environment?: Environment
  theme?: 'light' | 'dark'
}

export const Checkout = ({
  accessToken,
  successUrl,
  returnUrl,
  environment,
  theme,
  includeCheckoutId = true,
}: CheckoutConfig) => {
  const polar = createPolarCore({
    accessToken,
    environment,
  })

  return async (req: NextRequest) => {
    const url = new URL(req.url)
    const products = url.searchParams.getAll('products')

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'Missing products in query params' },
        { status: 400 },
      )
    }

    const success = successUrl ? new URL(successUrl) : undefined

    if (success && includeCheckoutId) {
      success.searchParams.set('checkoutId', '{CHECKOUT_ID}')
    }

    const retUrl = returnUrl ? new URL(returnUrl) : undefined

    try {
      const result = await createCheckouts(polar)({
        products,
        success_url: success ? decodeURI(success.toString()) : undefined,
        customer_id: url.searchParams.get('customerId') ?? undefined,
        external_customer_id:
          url.searchParams.get('customerExternalId') ?? undefined,
        customer_email: url.searchParams.get('customerEmail') ?? undefined,
        customer_name: url.searchParams.get('customerName') ?? undefined,
        customer_billing_address: url.searchParams.has('customerBillingAddress')
          ? JSON.parse(url.searchParams.get('customerBillingAddress') ?? '{}')
          : undefined,
        customer_tax_id: url.searchParams.get('customerTaxId') ?? undefined,
        customer_ip_address:
          url.searchParams.get('customerIpAddress') ?? undefined,
        customer_metadata: url.searchParams.has('customerMetadata')
          ? JSON.parse(url.searchParams.get('customerMetadata') ?? '{}')
          : undefined,
        allow_discount_codes: url.searchParams.has('allowDiscountCodes')
          ? url.searchParams.get('allowDiscountCodes') === 'true'
          : undefined,
        discount_id: url.searchParams.get('discountId') ?? undefined,
        metadata: url.searchParams.has('metadata')
          ? JSON.parse(url.searchParams.get('metadata') ?? '{}')
          : undefined,
        seats: url.searchParams.has('seats')
          ? Number.parseInt(url.searchParams.get('seats') ?? '1', 10)
          : undefined,
        return_url: retUrl ? decodeURI(retUrl.toString()) : undefined,
      })

      const redirectUrl = new URL(result.url)

      if (theme) {
        redirectUrl.searchParams.set('theme', theme)
      }

      return NextResponse.redirect(redirectUrl.toString())
    } catch (error) {
      console.error(error)
      return NextResponse.error()
    }
  }
}
