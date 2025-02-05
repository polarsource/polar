import { getClient, getServerURL } from '@/polar'
import {
  CheckoutFormProvider,
  CheckoutProvider,
} from '@polar-sh/checkout/providers'
import { checkoutsCreate } from '@polar-sh/sdk/funcs/checkoutsCreate'

import ClientPage from './ClientPage'

export default async function Page() {
  const client = getClient()
  const {
    ok,
    value: checkout,
    error,
  } = await checkoutsCreate(client, {
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
