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
