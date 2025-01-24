import { getServerURL } from '@/utils/api'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsCustomClientGet } from '@polar-sh/sdk/funcs/checkoutsCustomClientGet'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors'
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
  } = await checkoutsCustomClientGet(client, { clientSecret })

  if (!ok) {
    if (error instanceof ResourceNotFound) {
      notFound()
    } else {
      throw error
    }
  }

  if (checkout.status !== 'open') {
    redirect(checkout.successUrl)
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
