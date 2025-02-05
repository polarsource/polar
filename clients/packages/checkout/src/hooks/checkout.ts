import type { PolarCore } from '@polar-sh/sdk/core'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { useEffect, useMemo } from 'react'

import { createSSEListener } from '../utils/sse'

export const useCheckoutListener = (
  client: PolarCore,
  checkout: CheckoutPublic,
) => {
  const [checkoutEvents, listen] = useMemo(() => {
    // @ts-ignore
    const baseURL = client._baseURL
    return createSSEListener(
      `${baseURL}v1/checkouts/client/${checkout.clientSecret}/stream`,
    )
  }, [client, checkout])

  useEffect(() => {
    const controller = listen()
    return controller.abort
  }, [listen])

  return checkoutEvents
}
