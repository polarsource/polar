import { getPublicServerURL } from '@/utils/api'
import { getServerSideAPI } from '@/utils/client/serverside'
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
  redirect_status?: string
  polar_setup_intent?: string
}

const isValidEmbedOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin)
    if (origin !== url.origin) return false
    if (url.protocol === 'https:') return true
    if (url.protocol === 'http:') {
      return ['localhost', '127.0.0.1'].includes(url.hostname)
    }
    return false
  } catch {
    return false
  }
}

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
    redirect_status,
    polar_setup_intent,
  } = await props.searchParams

  const embedOrigin =
    embed_origin && isValidEmbedOrigin(embed_origin) ? embed_origin : undefined

  if (!sessionToken || !embedOrigin) {
    return <EmbedError code="invalid_request" embedOrigin={embedOrigin} />
  }

  const embedReturnUrl = resolveEmbedReturnUrl(embed_return_url, embedOrigin)

  const api = await getServerSideAPI(sessionToken)
  let customer
  try {
    customer = await unwrap(
      api.GET('/v1/customer-portal/customers/me', { cache: 'no-store' }),
    )
  } catch (error) {
    return (
      <EmbedError
        code={
          error instanceof UnauthorizedResponseError
            ? 'unauthorized'
            : 'unknown'
        }
        embedOrigin={embedOrigin}
      />
    )
  }

  return (
    <PaymentMethodEmbed
      sessionToken={sessionToken}
      embedOrigin={embedOrigin}
      embedReturnUrl={embedReturnUrl}
      theme={theme}
      mode={mode === 'modal' ? 'modal' : 'inline'}
      setAsDefault={set_default !== 'false'}
      serverURL={getPublicServerURL()}
      customerBillingDetails={{
        name: customer.name ?? null,
        email: customer.email ?? null,
        address: customer.billing_address ?? null,
      }}
      redirectStatus={redirect_status}
      setupIntentId={polar_setup_intent}
    />
  )
}
