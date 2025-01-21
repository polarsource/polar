import type { PolarCore } from '@polar-sh/sdk/core'
import type { CheckoutStatus } from '@polar-sh/sdk/models/components/CheckoutStatus'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import { EventSourcePlus } from 'event-source-plus'
import EventEmitter from 'eventemitter3'
import { useCallback, useMemo, useState } from 'react'

export const useCheckoutFulfillmentListener = (
  client: PolarCore,
  checkout: CheckoutPublic,
  maxWaitingTimeMs: number = 30000,
): [() => Promise<void>, string | null] => {
  const checkoutEvents = useMemo(() => new EventEmitter(), [])
  const [fulfillmentLabel, setFulfillmentLabel] = useState<string | null>(null)

  const fulfillmentListener = useCallback(async () => {
    return await new Promise<void>((resolve) => {
      // @ts-ignore
      const baseURL = client._baseURL
      const url = `${baseURL}v1/checkouts/custom/client/${checkout.clientSecret}/stream`
      const eventSource = new EventSourcePlus(url, {
        credentials: 'include',
      })
      const controller = eventSource.listen({
        onMessage: async (message) => {
          const data = JSON.parse(message.data)
          checkoutEvents.emit(data.key, data.payload)
        },
      })

      let checkoutSuccessful = false
      let orderCreated = false
      let subscriptionCreated = checkout.productPrice.type !== 'recurring'
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

      const webhookEventDeliveredListener = (data?: {
        status: CheckoutStatus
      }) => {
        if (!data || data.status === 'succeeded') {
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
      // Wait webhook event to be delivered for 30 seconds max
      setTimeout(() => webhookEventDeliveredListener(), maxWaitingTimeMs)
    })
  }, [client, checkout, checkoutEvents, maxWaitingTimeMs])

  return [fulfillmentListener, fulfillmentLabel]
}
