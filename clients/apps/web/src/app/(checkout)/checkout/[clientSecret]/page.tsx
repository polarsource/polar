import { getPublicServerURL, getServerURL } from '@/utils/api'
import { getSSRHeaders } from '@/utils/client'
import { resolveLocale } from '@/utils/i18n'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import {
  ClientResponseError,
  NotFoundResponseError,
  createClient,
  unwrap,
} from '@polar-sh/client'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import CheckoutPage from './CheckoutPage'

export async function generateMetadata(props: {
  params: Promise<{ clientSecret: string }>
}): Promise<Metadata> {
  const params = await props.params
  const { clientSecret } = params

  const client = createClient(getServerURL(), undefined, getSSRHeaders())
  const { data: checkout } = await client.GET(
    '/v1/checkouts/client/{client_secret}',
    { params: { path: { client_secret: clientSecret } } },
  )

  if (!checkout?.product) {
    return { title: 'Checkout | Polar' }
  }

  return {
    title: `${checkout.organization.name} | ${checkout.product.name}`,
  }
}

export default async function Page(props: {
  params: Promise<{ clientSecret: string }>
  searchParams: Promise<{
    embed?: string
    theme?: 'light' | 'dark'
    locale?: string
  }>
}) {
  const searchParams = await props.searchParams

  const { embed: _embed, theme, locale: _locale } = searchParams

  const params = await props.params

  const { clientSecret } = params

  const embed = _embed === 'true'
  const client = createClient(getServerURL(), undefined, getSSRHeaders())

  let checkout
  try {
    checkout = await unwrap(
      client.GET('/v1/checkouts/client/{client_secret}', {
        params: { path: { client_secret: clientSecret } },
      }),
    )
  } catch (error) {
    if (error instanceof NotFoundResponseError) {
      notFound()
    } else if (
      error instanceof ClientResponseError &&
      error.response.status === 410
    ) {
      notFound() // TODO: show expired checkout page
    } else {
      throw error
    }
  }

  if (checkout.status === 'succeeded') {
    redirect(checkout.success_url)
  }

  if (checkout.status !== 'open') {
    redirect(`/checkout/${checkout.client_secret}/confirmation`)
  }

  const locale = await resolveLocale(_locale, checkout.locale)

  return (
    <CheckoutProvider
      clientSecret={checkout.client_secret}
      initialCheckout={checkout}
      serverURL={getPublicServerURL()}
    >
      <CheckoutFormProvider locale={locale}>
        <CheckoutPage theme={theme} embed={embed} locale={locale} />
      </CheckoutFormProvider>
    </CheckoutProvider>
  )
}
