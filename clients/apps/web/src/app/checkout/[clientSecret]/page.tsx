import { getServerURL } from '@/utils/api'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsClientGet } from '@polar-sh/sdk/funcs/checkoutsClientGet'
import { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
import { notFound, redirect } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({
  params: { clientSecret },
  searchParams: { embed: _embed, theme, ...prefilledParameters },
}: {
  params: { clientSecret: string }
  searchParams: { embed?: string; theme?: 'light' | 'dark' } & Record<
    string,
    string
  >
}) {
  const embed = _embed === 'true'
  const client = new PolarCore({ serverURL: getServerURL() })

  const {
    ok,
    value: checkout,
    error,
  } = await checkoutsClientGet(client, { clientSecret })

  if (!ok) {
    if (error instanceof ResourceNotFound) {
      notFound()
    } else if (error instanceof ExpiredCheckoutError) {
      // This should rarely happen now since the backend recreates expired sessions,
      // but if it does, show a not found page
      notFound()
    } else {
      throw error
    }
  }

  // Check if the returned checkout has a different client secret
  // This means the backend recreated an expired session
  if (checkout.clientSecret !== clientSecret) {
    const searchParamsString = new URLSearchParams({
      ...(_embed && { embed: _embed }),
      ...(theme && { theme }),
      ...prefilledParameters,
    }).toString()
    
    const redirectUrl = `/checkout/${checkout.clientSecret}${
      searchParamsString ? `?${searchParamsString}` : ''
    }`
    
    redirect(redirectUrl)
  }

  if (checkout.status === 'succeeded') {
    redirect(checkout.successUrl)
  }

  if (checkout.status !== 'open') {
    redirect(`/checkout/${checkout.clientSecret}/confirmation`)
  }

  return (
    <CheckoutProvider
      clientSecret={checkout.clientSecret}
      serverURL={getServerURL()}
    >
      <CheckoutFormProvider prefilledParameters={prefilledParameters}>
        <ClientPage theme={theme} embed={embed} />
      </CheckoutFormProvider>
    </CheckoutProvider>
  )
}
