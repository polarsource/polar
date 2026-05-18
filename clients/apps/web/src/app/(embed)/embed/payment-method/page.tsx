import { getPublicServerURL } from '@/utils/api'
import { getServerSideAPI } from '@/utils/client/serverside'
import type { Metadata } from 'next'
import { EmbedError } from './EmbedError'
import { PaymentMethodEmbed } from './PaymentMethodEmbed'

export const metadata: Metadata = {
  title: 'Add payment method | Polar',
  robots: { index: false, follow: false },
}

interface SearchParams {
  customer_session_token?: string
  member_session_token?: string
  embed_origin?: string
  theme?: 'light' | 'dark'
  mode?: 'modal' | 'inline'
  setup_intent_client_secret?: string
  setup_intent?: string
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

export default async function Page(props: {
  searchParams: Promise<SearchParams>
}) {
  const {
    customer_session_token,
    member_session_token,
    embed_origin,
    theme,
    mode,
    setup_intent_client_secret,
    setup_intent,
  } = await props.searchParams

  const embedOrigin =
    embed_origin && isValidEmbedOrigin(embed_origin) ? embed_origin : undefined

  const sessionToken =
    customer_session_token && member_session_token
      ? null
      : (customer_session_token ?? member_session_token)

  if (!sessionToken || !embedOrigin) {
    return <EmbedError code="invalid_request" embedOrigin={embedOrigin} />
  }

  const api = await getServerSideAPI(sessionToken)
  const { response } = await api.GET('/v1/customer-portal/customers/me', {
    cache: 'no-store',
  })

  if (response.status === 401) {
    return <EmbedError code="unauthorized" embedOrigin={embedOrigin} />
  }

  if (!response.ok) {
    return <EmbedError code="unknown" embedOrigin={embedOrigin} />
  }

  return (
    <PaymentMethodEmbed
      sessionToken={sessionToken}
      embedOrigin={embedOrigin}
      theme={theme}
      mode={mode === 'modal' ? 'modal' : 'inline'}
      serverURL={getPublicServerURL()}
      setupIntentParams={
        setup_intent_client_secret && setup_intent
          ? { setup_intent_client_secret, setup_intent }
          : undefined
      }
    />
  )
}
