import { getPublicServerURL } from '@/utils/api'
import { getServerSideAPI } from '@/utils/client/serverside'
import {
  DEFAULT_LOCALE,
  isAcceptedLocale,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { unwrap, UnauthorizedResponseError } from '@polar-sh/client'
import type { Metadata } from 'next'
import { EmbedError } from './EmbedError'
import { PaymentMethodEmbed } from './PaymentMethodEmbed'

export const metadata: Metadata = {
  title: 'Add payment method | Polar',
  robots: { index: false, follow: false },
}

interface SearchParams {
  session_token?: string
  embed_origin?: string
  embed_return_url?: string
  theme?: 'light' | 'dark'
  mode?: 'modal' | 'inline'
  set_default?: string
  locale?: string
  redirect_status?: string
  polar_setup_intent?: string
}

const resolveLocale = (locale: string | undefined): AcceptedLocale =>
  locale && isAcceptedLocale(locale) ? locale : DEFAULT_LOCALE

const resolveEmbedReturnUrl = (
  returnUrl: string | undefined,
  embedOrigin: string,
): string => {
  if (returnUrl) {
    try {
      if (new URL(returnUrl).origin === embedOrigin) return returnUrl
    } catch {
      // do nothing
    }
  }
  return embedOrigin
}

export default async function Page(props: {
  searchParams: Promise<SearchParams>
}) {
  const {
    session_token: sessionToken,
    embed_origin,
    embed_return_url,
    theme,
    mode,
    set_default,
    locale: localeParam,
    redirect_status,
    polar_setup_intent,
  } = await props.searchParams

  const locale = resolveLocale(localeParam)

  if (!sessionToken || !embed_origin) {
    return <EmbedError code="invalid_request" locale={locale} />
  }

  const api = await getServerSideAPI(sessionToken)
  let customer
  let embedPolicy
  try {
    ;[customer, embedPolicy] = await Promise.all([
      unwrap(
        api.GET('/v1/customer-portal/customers/me', { cache: 'no-store' }),
      ),
      unwrap(
        api.GET('/v1/customer-portal/customers/me/embed-policy', {
          params: { query: { embed_origin } },
          cache: 'no-store',
        }),
      ),
    ])
  } catch (error) {
    return (
      <EmbedError
        code={
          error instanceof UnauthorizedResponseError
            ? 'unauthorized'
            : 'unknown'
        }
        locale={locale}
      />
    )
  }

  const embedOrigin = embedPolicy.embed_origin
  if (!embedOrigin) {
    return <EmbedError code="invalid_request" locale={locale} />
  }

  const embedReturnUrl = resolveEmbedReturnUrl(embed_return_url, embedOrigin)

  let setupCurrency = 'usd'
  try {
    const subscriptions = await unwrap(
      api.GET('/v1/customer-portal/subscriptions/', {
        params: { query: { active: true, limit: 1 } },
        cache: 'no-store',
      }),
    )
    setupCurrency = subscriptions.items[0]?.currency ?? 'usd'
  } catch {
    // A failed request only narrows the offered payment methods to the USD set
  }

  return (
    <PaymentMethodEmbed
      sessionToken={sessionToken}
      embedOrigin={embedOrigin}
      embedReturnUrl={embedReturnUrl}
      theme={theme}
      mode={mode === 'modal' ? 'modal' : 'inline'}
      setAsDefault={set_default !== 'false'}
      locale={locale}
      serverURL={getPublicServerURL()}
      customerBillingDetails={{
        name: customer.name ?? null,
        email: customer.email ?? null,
        address: customer.billing_address ?? null,
      }}
      setupCurrency={setupCurrency}
      redirectStatus={redirect_status}
      setupIntentId={polar_setup_intent}
    />
  )
}
