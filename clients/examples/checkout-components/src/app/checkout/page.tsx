import { getClient, getServerURL } from '@/polar'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import { checkoutsCustomCreate } from '@polar-sh/sdk/funcs/checkoutsCustomCreate'

import ClientPage from './ClientPage'

export default async function Page() {
  const client = getClient()
  const {
    ok,
    value: checkout,
    error,
  } = await checkoutsCustomCreate(client, {
    productId: process.env.POLAR_PRODUCT_ID as string,
  })

  if (!ok) {
    throw error
  }

  return (
    <CheckoutProvider
      clientSecret={checkout.clientSecret}
      serverURL={getServerURL()}
    >
      <CheckoutFormProvider>
        <ClientPage />
      </CheckoutFormProvider>
    </CheckoutProvider>
  )
}
