import { getPublicServerURL, getServerURL } from '@/utils/api'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import { I18nProvider, type SupportedLocale } from '@polar-sh/i18n'
import { loadLocale } from '@polar-sh/i18n/messages'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsClientGet } from '@polar-sh/sdk/funcs/checkoutsClientGet'
import { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
import { notFound, redirect } from 'next/navigation'
import CheckoutPage from './CheckoutPage'

export default async function Page(props: {
  params: Promise<{ clientSecret: string }>
  searchParams: Promise<{ embed?: string; theme?: 'light' | 'dark'; locale?: string }>
}) {
  const searchParams = await props.searchParams

  const { embed: _embed, theme, locale: localeParam } = searchParams

  const params = await props.params

  const { clientSecret } = params

  const embed = _embed === 'true'
  const client = new PolarCore({ serverURL: getServerURL() })

  const {
    ok,
    value: checkout,
    error,
  } = await checkoutsClientGet(
    client,
    {
      clientSecret,
    },
    {
      // We can see infrequent issues with checkouts rendering a white screen of death, correlated with this error in Vercel's logs:
      // `[ConnectionError]: Unable to make request: TypeError: fetch failed`.
      // The `[ConnectionError]` is something our own SDK adds, but it looks like temporary hiccups with our API connection.
      // Other theories are something with our Cloudflare setup or timing issues (i.e. accessing a checkout during deployment).
      // Regardless of root cause, I want to retry this fetch to see if that mitigates the issue.
      //
      // Because it's a connection issue, let's retry quickly and often but give up quickly if it doesn't fix itself.
      //
      // — @pieterbeulque
      retries: {
        strategy: 'backoff',
        backoff: {
          initialInterval: 200,
          maxInterval: 2000,
          exponent: 2,
          maxElapsedTime: 15_000,
        },
        retryConnectionErrors: true,
      },
    },
  )

  if (!ok) {
    if (error instanceof ResourceNotFound) {
      notFound()
    } else if (error instanceof ExpiredCheckoutError) {
      notFound() // TODO: show expired checkout page
    } else {
      throw error
    }
  }

  if (checkout.status === 'succeeded') {
    redirect(checkout.successUrl)
  }

  if (checkout.status !== 'open') {
    redirect(`/checkout/${checkout.clientSecret}/confirmation`)
  }

  // Locale resolution priority:
  // 1. ?locale query string
  // 2. checkout.locale (TODO: backend to implement)
  // 3. customer.locale (TODO: backend to implement)
  // 4. Accept-Language (TODO: backend to implement)
  // 5. English fallback
  const locale: SupportedLocale = (localeParam as SupportedLocale) ?? 'en'
  const messages = loadLocale(locale)

  return (
    <I18nProvider locale={locale} messages={messages}>
      <CheckoutProvider
        clientSecret={checkout.clientSecret}
        serverURL={getPublicServerURL()}
      >
        <CheckoutFormProvider>
          <CheckoutPage theme={theme} embed={embed} />
        </CheckoutFormProvider>
      </CheckoutProvider>
    </I18nProvider>
  )
}
