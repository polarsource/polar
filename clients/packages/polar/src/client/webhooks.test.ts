import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, expectTypeOf, test, vi } from 'vitest'
import { RuntimeSDK } from '../runtime'
import { defineConfig } from '../schema/config'
import type { WebhookEventOf, WebhookHandlerLoader } from '../schema/webhook'
import type { WebhookRoute } from './webhooks'

const signingKey = Buffer.from('signing-key')
const secret = `whsec_${signingKey.toString('base64')}`

const signed = (payload: unknown, key = signingKey) => {
  const body = JSON.stringify(payload)
  const id = 'msg_1'
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  return new Request('https://app.test/api/polar/webhooks', {
    method: 'POST',
    body,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(timestamp),
      'webhook-signature': `v1,${signature}`,
    },
  })
}

const orderPaid = {
  type: 'order.paid',
  timestamp: '2026-10-01T12:00:00Z',
  data: { id: 'order-1' },
}

const connect = (handler: WebhookHandlerLoader) => {
  const config = defineConfig({
    meters: () => ({}),
    webhooks: ({ endpoint, slack }) => ({
      app: endpoint('https://app.test/api/polar/webhooks')
        .on('order.paid', 'subscription.canceled')
        .secret('APP_WEBHOOK_SECRET')
        .handle(handler),
      sales: slack('https://hooks.slack.com/services/T0/B0/token').on(
        'order.paid',
      ),
    }),
  })
  return { config, polar: RuntimeSDK(config, { accessToken: 'test' }) }
}

beforeEach(() => {
  vi.stubEnv('APP_WEBHOOK_SECRET', secret)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('RuntimeSDK exposes routes only for webhooks with a handler', () => {
  const { polar } = connect(async () => () => {})
  expect(Object.keys(polar.webhooks)).toEqual(['app'])
  expectTypeOf(polar.webhooks).toEqualTypeOf<{ readonly app: WebhookRoute }>()
})

test('a verified, declared event is passed to the handler and acknowledged', async () => {
  const handle = vi.fn()
  const { config, polar } = connect(async () => handle)
  expectTypeOf<WebhookEventOf<typeof config, 'app'>['type']>().toEqualTypeOf<
    'order.paid' | 'subscription.canceled'
  >()

  const response = await polar.webhooks.app(signed(orderPaid))

  expect(response.status).toBe(202)
  expect(handle).toHaveBeenCalledExactlyOnceWith(orderPaid)
})

test('bad signatures and typeless bodies are rejected without loading the handler', async () => {
  const loader = vi.fn(async () => () => {})
  const { polar } = connect(loader)

  const forged = await polar.webhooks.app(
    signed(orderPaid, Buffer.from('other-key')),
  )
  const typeless = await polar.webhooks.app(signed({ data: {} }))

  expect(forged.status).toBe(403)
  expect(typeless.status).toBe(400)
  expect(loader).not.toHaveBeenCalled()
})

test('events the endpoint does not declare are acknowledged without loading the handler', async () => {
  const loader = vi.fn(async () => () => {})
  const { polar } = connect(loader)

  const response = await polar.webhooks.app(
    signed({ ...orderPaid, type: 'order.refunded' }),
  )

  expect(response.status).toBe(202)
  expect(loader).not.toHaveBeenCalled()
})

test('a default-export handler module is loaded once across requests', async () => {
  const handle = vi.fn()
  const loader = vi.fn(async () => ({ default: handle }))
  const { polar } = connect(loader)

  await polar.webhooks.app(signed(orderPaid))
  await polar.webhooks.app(signed(orderPaid))

  expect(loader).toHaveBeenCalledOnce()
  expect(handle).toHaveBeenCalledTimes(2)
})

test('a handler that fails to load is loaded again on the next request', async () => {
  const handle = vi.fn()
  const loader = vi
    .fn<WebhookHandlerLoader>()
    .mockRejectedValueOnce(new Error('chunk failed'))
    .mockResolvedValue(handle)
  const { polar } = connect(loader)

  await expect(polar.webhooks.app(signed(orderPaid))).rejects.toThrow(
    'chunk failed',
  )
  const response = await polar.webhooks.app(signed(orderPaid))

  expect(response.status).toBe(202)
  expect(loader).toHaveBeenCalledTimes(2)
  expect(handle).toHaveBeenCalledOnce()
})
