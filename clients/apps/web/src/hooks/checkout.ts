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

      // Fire-and-forget: once the iframe observes that the order has been
      // created and the merchant's webhook delivered, post a `fulfilled`
      // event so the merchant can provision benefits / send confirmation
      // emails on a signal they can actually trust. `success` fires
      // immediately above; `fulfilled` arrives 1-15s later (or with
      // status='timeout' if the listener gives up).
      //
      // Only relevant for internal success URLs — external URLs already
      // await `listenFulfillment` above before posting `success`, and the
      // parent navigates away as soon as the success message arrives.
      if (checkout.embed_origin && isInternalURL && listenFulfillment) {
        const origin = checkout.embed_origin
        const basePayload = {
          event: 'fulfilled' as const,
          checkoutId: checkout.id,
          customerId: checkout.customer_id,
        }
        listenFulfillment().then(
          () =>
            PolarEmbedCheckout.postMessage(
              { ...basePayload, status: 'completed' },
              origin,
            ),
          () =>
            PolarEmbedCheckout.postMessage(
              { ...basePayload, status: 'timeout' },
              origin,
            ),
        )
      }

      // In embed mode, the parent window owns post-success navigation via the
      // `success` postMessage above. Navigating the iframe ourselves would
      // strand the customer inside the overlay (e.g. on the customer portal
      // sign-in page) with no way back to the merchant's site short of a hard
      // reload.
      if (embed) {
        return
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

      router.push(parsedURL.toString())
    },
    [router, embed, theme, listenFulfillment],
  )
}
