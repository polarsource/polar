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
      success.searchParams.set('checkout_id', '{CHECKOUT_ID}')
    }

    const retUrl = returnUrl ? new URL(returnUrl) : undefined

    try {
      const result = await createCheckouts(polar)({
        products,
        success_url: success ? decodeURI(success.toString()) : undefined,
        customer_id: url.searchParams.get('customer_id') ?? undefined,
        external_customer_id:
          url.searchParams.get('external_customer_id') ?? undefined,
        customer_email: url.searchParams.get('customer_email') ?? undefined,
        customer_name: url.searchParams.get('customer_name') ?? undefined,
        customer_billing_address: url.searchParams.has(
          'customer_billing_address',
        )
          ? JSON.parse(url.searchParams.get('customer_billing_address') ?? '{}')
          : undefined,
        customer_tax_id: url.searchParams.get('customer_tax_id') ?? undefined,
        customer_ip_address:
          url.searchParams.get('customer_ip_address') ?? undefined,
        customer_metadata: url.searchParams.has('customer_metadata')
          ? JSON.parse(url.searchParams.get('customer_metadata') ?? '{}')
          : undefined,
        allow_discount_codes: url.searchParams.has('allow_discount_codes')
          ? url.searchParams.get('allow_discount_codes') === 'true'
          : undefined,
        discount_id: url.searchParams.get('discount_id') ?? undefined,
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
