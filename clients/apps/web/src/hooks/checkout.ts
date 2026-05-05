import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { useCheckoutFulfillmentListener } from '@polar-sh/checkout/hooks'
import type { Client, schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { CONFIG } from '@/utils/config'

export const useCheckoutConfirmedRedirect = (
  client: Client,
  checkout: schemas['CheckoutPublic'],
  embed: boolean,
  theme?: 'light' | 'dark',
) => {
  const router = useRouter()
  const [listenFulfillment, fulfillmentLabel] = useCheckoutFulfillmentListener(
    client,
    checkout,
  )
  const redirect = useCallback(
    async (
      confirmedCheckout: schemas['CheckoutPublic'],
      customerSessionToken: string | null | undefined,
    ) => {
      if (confirmedCheckout.embed_origin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'confirmed',
          },
          confirmedCheckout.embed_origin,
        )
      }

      const parsedURL = new URL(confirmedCheckout.success_url)
      const isInternalURL = confirmedCheckout.success_url.startsWith(
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
      if (!isInternalURL) {
        try {
          await listenFulfillment()
        } catch {
          // The fullfillment listener timed out.
          // Redirect to confirm page where we'll be able to recover
          router.push(
            `/checkout/${confirmedCheckout.client_secret}/confirmation?${parsedURL.searchParams}`,
          )
          return
        }
      }

      if (confirmedCheckout.embed_origin) {
        PolarEmbedCheckout.postMessage(
          {
            event: 'success',
            successURL: parsedURL.toString(),
            redirect: !isInternalURL,
          },
          confirmedCheckout.embed_origin,
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
      if (confirmedCheckout.embed_origin && isInternalURL) {
        const origin = confirmedCheckout.embed_origin
        const basePayload = {
          event: 'fulfilled' as const,
          checkoutId: confirmedCheckout.id,
          customerId: confirmedCheckout.customer_id,
        }

        listenFulfillment().then(
          () => {
            PolarEmbedCheckout.postMessage(
              { ...basePayload, status: 'completed' },
              origin,
            )
          },
          () => {
            PolarEmbedCheckout.postMessage(
              { ...basePayload, status: 'timeout' },
              origin,
            )
          },
        )
      }

      // If we don't have a customer session token, redirect to customer portal login
      // instead of internal success URL
      if (isInternalURL && !customerSessionToken) {
        const {
          organization: { slug },
          customer_email,
        } = confirmedCheckout
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
  return [redirect, fulfillmentLabel] as const
}
