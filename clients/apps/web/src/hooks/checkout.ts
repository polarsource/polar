import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import type { schemas } from '@polar-sh/client'
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
      checkout: schemas['CheckoutPublic'],
      customerSessionToken: string | null | undefined,
    ) => {
      if (checkout.embed_origin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'confirmed',
          },
          checkout.embed_origin,
        )
      }

      const parsedURL = new URL(checkout.success_url)
      const isInternalURL = checkout.success_url.startsWith(
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
            `/checkout/${checkout.client_secret}/confirmation?${parsedURL.searchParams}`,
          )
          return
        }
      }

      if (checkout.embed_origin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'success',
            successURL: parsedURL.toString(),
            redirect: !isInternalURL,
          },
          checkout.embed_origin,
        )
      }

      // If we don't have a customer session token, redirect to customer portal login
      // instead of internal success URL
      if (isInternalURL && !customerSessionToken) {
        const {
          organization: { slug },
          customer_email,
        } = checkout
        if (customer_email) {
          parsedURL.searchParams.set('email', customer_email)
        }
        router.push(`/${slug}/portal/request?${parsedURL.searchParams}`)
        return
      }

      if (isInternalURL || !embed) {
        router.push(parsedURL.toString())
      }
    },
    [router, embed, theme, listenFulfillment],
  )
}
