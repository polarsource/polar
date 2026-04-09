import { CheckoutConfirmation } from '@/components/Checkout/CheckoutConfirmation'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { getServerURL } from '@/utils/api'
import { getSSRHeaders } from '@/utils/client'
import { resolveLocale } from '@/utils/i18n'
import {
  ClientResponseError,
  NotFoundResponseError,
  createClient,
  unwrap,
} from '@polar-sh/client'
import { notFound, redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ clientSecret: string }>
  searchParams: Promise<{
    embed?: string
    theme?: 'light' | 'dark'
    locale?: string
    customer_session_token?: string
  }>
}) {
  const searchParams = await props.searchParams

  const { embed, theme, locale: _locale, customer_session_token } = searchParams

  const params = await props.params

  const { clientSecret } = params

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

  if (checkout.status === 'open') {
    redirect(checkout.url)
  }

  const locale = await resolveLocale(_locale, checkout.locale)

  return (
    <CheckoutLayout checkout={checkout} embed={embed === 'true'} theme={theme}>
      <CheckoutConfirmation
        checkout={checkout}
        embed={embed === 'true'}
        theme={theme}
        locale={locale}
        customerSessionToken={customer_session_token}
      />
    </CheckoutLayout>
  )
}
