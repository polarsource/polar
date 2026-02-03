import { SpaireEmbedCheckout } from '@spaire/checkout/embed'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { CONFIG } from '@/utils/config'

export const useCheckoutConfirmedRedirect = (
  embed: boolean,
  theme?: 'light' | 'dark',
  listenFulfillment?: () => Promise<void>,
) => {
  const router = useRouter()
  return useCallback(
    async (
      checkout: CheckoutPublic,
      customerSessionToken: string | undefined,
    ) => {
      if (checkout.embedOrigin) {
        SpaireEmbedCheckout.postMessage(
          {
            event: 'confirmed',
          },
          checkout.embedOrigin,
        )
      }

      const parsedURL = new URL(checkout.successUrl)
      const isInternalURL = checkout.successUrl.startsWith(
        CONFIG.FRONTEND_BASE_URL,
      )

      if (isInternalURL) {
        if (embed) {
          parsedURL.searchParams.set('embed', 'true')
          if (theme) {
            parsedURL.searchParams.set('theme', theme)
          }
        }
      }

      if (customerSessionToken) {
        parsedURL.searchParams.set(
          'customer_session_token',
          customerSessionToken,
        )
      }

      // For external success URL, make sure the checkout is processed before redirecting
      // It ensures the user will have an up-to-date status when they are redirected,
      // especially if the external URL doesn't implement proper webhook handling
      if (!isInternalURL && listenFulfillment) {
        try {
          await listenFulfillment()
        } catch {
          // The fullfillment listener timed out.
          // Redirect to confirm page where we'll be able to recover
          router.push(
            `/checkout/${checkout.clientSecret}/confirmation?${parsedURL.searchParams}`,
          )
          return
        }
      }

      if (checkout.embedOrigin) {
        SpaireEmbedCheckout.postMessage(
          {
            event: 'success',
            successURL: parsedURL.toString(),
            redirect: !isInternalURL,
          },
          checkout.embedOrigin,
        )
      }

      if (isInternalURL || !embed) {
        router.push(parsedURL.toString())
      }
    },
    [router, embed, theme, listenFulfillment],
  )
}
