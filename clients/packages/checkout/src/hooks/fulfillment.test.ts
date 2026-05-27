import type { Client, schemas } from '@polar-sh/client'
import { renderHook } from '@testing-library/react'
import EventEmitter from 'eventemitter3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductCheckoutPublic } from '../guards'
import { createCheckout, createFixedPrice } from '../test-utils/makeCheckout'
import { useCheckoutFulfillmentListener } from './fulfillment'

const abortMock = vi.fn()
let events: EventEmitter

vi.mock('../utils/sse', () => ({
  createSSEListener: () => [events, () => ({ abort: abortMock })],
}))

const client = { baseUrl: 'https://api.example.com' } as unknown as Client

const emitSucceeded = () =>
  events.emit('checkout.updated', { status: 'succeeded' })
const emitOrderCreated = () => events.emit('checkout.order_created', {})
const emitSubscriptionCreated = () =>
  events.emit('checkout.subscription_created', {})
const emitWebhookDelivered = () =>
  events.emit('checkout.webhook_event_delivered', { status: 'succeeded' })

beforeEach(() => {
  events = new EventEmitter()
  abortMock.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

const isPending = (promise: Promise<unknown>): Promise<boolean> =>
  Promise.race([
    promise.then(
      () => false,
      () => false,
    ),
    new Promise<true>((resolve) => setTimeout(resolve, 10, true)),
  ])

const renderListener = (
  checkoutOverrides: Partial<ProductCheckoutPublic> = {},
  maxWaitingTimeMs = 15000,
) => {
  const checkout = createCheckout(checkoutOverrides)
  const { result } = renderHook(() =>
    useCheckoutFulfillmentListener(client, checkout, maxWaitingTimeMs),
  )
  return result.current[0]
}

describe('useCheckoutFulfillmentListener', () => {
  it('resolves only when status=succeeded AND order_created AND webhook_event_delivered', async () => {
    const promise = renderListener({ product_price: createFixedPrice() })()
    promise.catch(() => {})

    emitSucceeded()
    expect(await isPending(promise)).toBe(true)

    emitOrderCreated()
    expect(await isPending(promise)).toBe(true)

    emitWebhookDelivered()
    await expect(promise).resolves.toBeUndefined()
    expect(abortMock).toHaveBeenCalled()
  })

  it('does NOT resolve on status=confirmed', async () => {
    const promise = renderListener({ product_price: createFixedPrice() })()
    promise.catch(() => {})

    events.emit('checkout.updated', { status: 'confirmed' })
    emitOrderCreated()
    emitWebhookDelivered()

    expect(await isPending(promise)).toBe(true)
  })

  it('rejects after maxWaitingTimeMs with no events', async () => {
    vi.useFakeTimers()
    const promise = renderListener(
      { product_price: createFixedPrice() },
      15000,
    )()
    let rejected = false
    promise.catch(() => {
      rejected = true
    })

    await vi.advanceTimersByTimeAsync(14999)
    expect(rejected).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).rejects.toBeUndefined()
    expect(abortMock).toHaveBeenCalled()
  })

  it('also waits for subscription_created on legacy recurring product prices', async () => {
    const legacyRecurringPrice = {
      ...createFixedPrice(),
      type: 'recurring',
    } as unknown as schemas['LegacyRecurringProductPrice']

    const promise = renderListener({
      product_price: legacyRecurringPrice as unknown as schemas['ProductPrice'],
    })()
    promise.catch(() => {})

    emitSucceeded()
    emitOrderCreated()
    emitWebhookDelivered()
    expect(await isPending(promise)).toBe(true)

    emitSubscriptionCreated()
    await expect(promise).resolves.toBeUndefined()
    expect(abortMock).toHaveBeenCalled()
  })
})
