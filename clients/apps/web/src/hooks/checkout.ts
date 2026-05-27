import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import type { schemas } from '@polar-sh/client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

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

      // For our built-in success URL, checkout.success_url is `${checkout.url}/confirmation`
      const isInternalSuccessURL = checkout.success_url.startsWith(checkout.url)

      if (isInternalSuccessURL) {
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

      // Wait for actual payment fulfillment before declaring success when
      // either the redirect destination can't observe in flight state
      // (external success URL) or a merchant is listening on the parent
      // page (embed_origin). confirm() returning only means the payment
      // intent was dispatched to Stripe.
      // Without this gate, embed_origin receives a success postMessage on
      // a non-terminal state and merchants treat declined payments as
      // completed purchases.
      if ((!isInternalSuccessURL || embed) && listenFulfillment) {
        try {
          await listenFulfillment()
        } catch {
          // Fulfillment didn't complete within the timeout. Fall back to
          // our /confirmation page where the live state is rendered. Don't
          // emit a `success` postMessage to the merchant.
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
            redirect: !isInternalSuccessURL,
          },
          checkout.embed_origin,
        )
      }

      // If we don't have a customer session token, redirect to customer portal login
      // instead of internal success URL
      if (isInternalSuccessURL && !customerSessionToken) {
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

      if (isInternalSuccessURL || !embed) {
        router.push(parsedURL.toString())
      }
    },
    [router, embed, theme, listenFulfillment],
  )
}
