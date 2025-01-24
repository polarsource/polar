import { CheckoutConfirmation } from '@/components/Checkout/CheckoutConfirmation'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { getServerURL } from '@/utils/api'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsCustomClientGet } from '@polar-sh/sdk/funcs/checkoutsCustomClientGet'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors'
import { notFound, redirect } from 'next/navigation'

export default async function Page({
  params: { clientSecret },
  searchParams: { embed, theme, customer_session_token },
}: {
  params: { clientSecret: string }
  searchParams: {
    embed?: string
    theme?: 'light' | 'dark'
    customer_session_token?: string
  }
}) {
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

  if (checkout.status === 'open') {
    redirect(checkout.url)
  }

  return (
    <CheckoutLayout checkout={checkout} embed={embed === 'true'} theme={theme}>
      <CheckoutConfirmation
        checkout={checkout}
        organization={checkout.organization}
        customerSessionToken={customer_session_token}
      />
    </CheckoutLayout>
  )
}
