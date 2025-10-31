'use client'

import type { PolarCore } from '@polar-sh/sdk/core'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import type { CheckoutStatus } from '@polar-sh/sdk/models/components/checkoutstatus'
import { useCallback, useState } from 'react'

import { hasProductCheckout } from '../guards'
import { createSSEListener } from '../utils/sse'

export const useCheckoutFulfillmentListener = (
  client: PolarCore,
  checkout: CheckoutPublic,
  maxWaitingTimeMs: number = 15000,
): [() => Promise<void>, string | null] => {
  const [fulfillmentLabel, setFulfillmentLabel] = useState<string | null>(null)

  const fulfillmentListener = useCallback(async () => {
    return await new Promise<void>((resolve, reject) => {
      // @ts-ignore
      const baseURL = client._baseURL
      const url = `${baseURL}v1/checkouts/client/${checkout.clientSecret}/stream`
      const [checkoutEvents, listen] = createSSEListener(url)
      const controller = listen()

      let checkoutSuccessful = false
      let orderCreated = false
      let subscriptionCreated =
        !hasProductCheckout(checkout) ||
        checkout.productPrice.type !== 'recurring'
      let webhookEventDelivered = false

      const checkResolution = () => {
        if (checkoutSuccessful && orderCreated && subscriptionCreated) {
          setFulfillmentLabel(
            `Waiting confirmation from ${checkout.organization.name} `,
          )
        }
        if (
          checkoutSuccessful &&
          orderCreated &&
          subscriptionCreated &&
          webhookEventDelivered
        ) {
          controller.abort()
          resolve()
        }
      }

      const checkoutUpdatedListener = (data: { status: CheckoutStatus }) => {
        if (data.status === 'succeeded') {
          checkoutSuccessful = true
          setFulfillmentLabel('Payment successful! Processing order...')
          checkoutEvents.off('checkout.updated', checkoutUpdatedListener)
          checkResolution()
        }
      }
      checkoutEvents.on('checkout.updated', checkoutUpdatedListener)

      const orderCreatedListener = () => {
        orderCreated = true
        checkoutEvents.off('checkout.order_created', orderCreatedListener)
        checkResolution()
      }
      checkoutEvents.on('checkout.order_created', orderCreatedListener)

      const subscriptionCreatedListener = () => {
        subscriptionCreated = true
        checkoutEvents.off(
          'checkout.subscription_created',
          subscriptionCreatedListener,
        )
        checkResolution()
      }
      if (!subscriptionCreated) {
        checkoutEvents.on(
          'checkout.subscription_created',
          subscriptionCreatedListener,
        )
      }

      const webhookEventDeliveredListener = (data: {
        status: CheckoutStatus
      }) => {
        if (data.status === 'succeeded') {
          webhookEventDelivered = true
          checkoutEvents.off(
            'checkout.webhook_event_delivered',
            webhookEventDeliveredListener,
          )
          checkResolution()
        }
      }
      checkoutEvents.on(
        'checkout.webhook_event_delivered',
        webhookEventDeliveredListener,
      )

      // Set a timeout to abort the listener if it takes too long
      setTimeout(() => {
        controller.abort()
        reject()
      }, maxWaitingTimeMs)
    })
  }, [client, checkout, maxWaitingTimeMs])

  return [fulfillmentListener, fulfillmentLabel]
}
