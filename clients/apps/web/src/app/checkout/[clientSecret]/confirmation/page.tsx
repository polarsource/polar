import { CheckoutConfirmation } from '@/components/Checkout/CheckoutConfirmation'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { getServerURL } from '@/utils/api'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsClientGet } from '@polar-sh/sdk/funcs/checkoutsClientGet'
import { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
import { notFound, redirect } from 'next/navigation'

export default async function Page(props: {
  params: Promise<{ clientSecret: string }>
  searchParams: Promise<{
    embed?: string
    theme?: 'light' | 'dark'
    customer_session_token?: string
  }>
}) {
  const searchParams = await props.searchParams

  const { embed, theme, customer_session_token } = searchParams

  const params = await props.params

  const { clientSecret } = params

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

  if (checkout.status === 'open') {
    redirect(checkout.url)
  }

  return (
    <CheckoutLayout checkout={checkout} embed={embed === 'true'} theme={theme}>
      <CheckoutConfirmation
        checkout={checkout}
        embed={embed === 'true'}
        theme={theme}
        customerSessionToken={customer_session_token}
      />
    </CheckoutLayout>
  )
}
