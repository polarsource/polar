import { CheckoutConfirmation } from '@/components/Checkout/CheckoutConfirmation'
import CheckoutLayout from '@/components/Checkout/CheckoutLayout'
import { getServerURL } from '@/utils/api'
import { PolarCore } from '@polar-sh/sdk/core'
import { checkoutsClientGet } from '@polar-sh/sdk/funcs/checkoutsClientGet'
import { ExpiredCheckoutError } from '@polar-sh/sdk/models/errors/expiredcheckouterror'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound'
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
      ...(embed && { embed }),
      ...(theme && { theme }),
      ...(customer_session_token && { customer_session_token }),
    }).toString()
    
    const redirectUrl = `/checkout/${checkout.clientSecret}/confirmation${
      searchParamsString ? `?${searchParamsString}` : ''
    }`
    
    redirect(redirectUrl)
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
