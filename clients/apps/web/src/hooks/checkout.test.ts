import type { schemas } from '@polar-sh/client'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCheckoutConfirmedRedirect } from './checkout'

const postMessageMock = vi.fn()
const pushMock = vi.fn()

vi.mock('@polar-sh/checkout/embed', () => ({
  PolarEmbedCheckout: {
    postMessage: (...args: unknown[]) => postMessageMock(...args),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

beforeEach(() => {
  postMessageMock.mockClear()
  pushMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

const CHECKOUT_URL = 'https://polar.sh/checkout/cs_test'
const EMBED_ORIGIN = 'https://beppe.com'

const baseCheckout = (
  overrides: Partial<schemas['CheckoutPublic']> = {},
): schemas['CheckoutPublic'] =>
  ({
    client_secret: 'cs_test',
    url: CHECKOUT_URL,
    success_url: `${CHECKOUT_URL}/confirmation`,
    embed_origin: null,
    customer_email: null,
    organization: { slug: 'test-org' },
    ...overrides,
  }) as unknown as schemas['CheckoutPublic']

const callHook = async (args: {
  embed: boolean
  listenFulfillment?: () => Promise<void>
  checkout: schemas['CheckoutPublic']
  customerSessionToken?: string | null
}) => {
  const { result } = renderHook(() =>
    useCheckoutConfirmedRedirect(args.embed, undefined, args.listenFulfillment),
  )
  const token =
    'customerSessionToken' in args ? args.customerSessionToken : 'tok_123'
  await result.current(args.checkout, token)
}

const successPostMessageCalls = () =>
  postMessageMock.mock.calls.filter(
    ([payload]) => (payload as { event: string }).event === 'success',
  )

describe('useCheckoutConfirmedRedirect', () => {
  it('waits for listenFulfillment when embed + internal success URL', async () => {
    let fulfillmentResolved = false
    const listenFulfillment = vi.fn(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            fulfillmentResolved = true
            resolve()
          }, 0),
        ),
    )

    const successBeforeAwait = postMessageMock.mock.calls.length

    await callHook({
      embed: true,
      listenFulfillment,
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
    })

    expect(listenFulfillment).toHaveBeenCalledTimes(1)
    expect(fulfillmentResolved).toBe(true)
    expect(successPostMessageCalls()).toHaveLength(1)
    expect(postMessageMock.mock.calls.length).toBeGreaterThan(
      successBeforeAwait,
    )
  })

  it('waits for listenFulfillment when embed + external success URL', async () => {
    const listenFulfillment = vi.fn(() => Promise.resolve())

    await callHook({
      embed: true,
      listenFulfillment,
      checkout: baseCheckout({
        embed_origin: EMBED_ORIGIN,
        success_url: 'https://example.com/thanks',
      }),
    })

    expect(listenFulfillment).toHaveBeenCalledTimes(1)
    expect(successPostMessageCalls()).toHaveLength(1)
  })

  it('waits for listenFulfillment when non-embed + external success URL', async () => {
    const listenFulfillment = vi.fn(() => Promise.resolve())

    await callHook({
      embed: false,
      listenFulfillment,
      checkout: baseCheckout({
        success_url: 'https://example.com/thanks',
      }),
    })

    expect(listenFulfillment).toHaveBeenCalledTimes(1)
  })

  it('does NOT wait when non-embed + internal success URL', async () => {
    const listenFulfillment = vi.fn(() => Promise.resolve())

    await callHook({
      embed: false,
      listenFulfillment,
      checkout: baseCheckout(),
    })

    expect(listenFulfillment).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT emit success postMessage when listenFulfillment rejects', async () => {
    const listenFulfillment = vi.fn(() => Promise.reject(new Error('timeout')))

    await callHook({
      embed: true,
      listenFulfillment,
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
    })

    expect(successPostMessageCalls()).toHaveLength(0)
  })

  it('redirects to /confirmation when listenFulfillment rejects', async () => {
    const listenFulfillment = vi.fn(() => Promise.reject(new Error('timeout')))

    await callHook({
      embed: true,
      listenFulfillment,
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
    })

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock.mock.calls[0][0]).toMatch(
      /^\/checkout\/cs_test\/confirmation/,
    )
  })

  it('emits `confirmed` to embed_origin immediately, before any wait', async () => {
    let confirmedEmittedDuringWait = false
    const listenFulfillment = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          confirmedEmittedDuringWait = postMessageMock.mock.calls.some(
            ([payload]) => (payload as { event: string }).event === 'confirmed',
          )
          resolve()
        }),
    )

    await callHook({
      embed: true,
      listenFulfillment,
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
    })

    expect(confirmedEmittedDuringWait).toBe(true)
  })

  it('does not emit either event when embed_origin is null', async () => {
    await callHook({
      embed: false,
      listenFulfillment: vi.fn(() => Promise.resolve()),
      checkout: baseCheckout({ embed_origin: null }),
    })

    expect(postMessageMock).not.toHaveBeenCalled()
  })

  it('redirects to /portal/request instead of internal success URL when customer_session_token is missing', async () => {
    await callHook({
      embed: false,
      listenFulfillment: vi.fn(() => Promise.resolve()),
      checkout: baseCheckout({
        customer_email: 'beppe@example.com',
      }),
      customerSessionToken: null,
    })

    expect(pushMock).toHaveBeenCalledTimes(1)
    const pushedURL = pushMock.mock.calls[0][0] as string
    expect(pushedURL).toMatch(/^\/test-org\/portal\/request\?/)
    expect(pushedURL).toContain('email=beppe%40example.com')
  })

  it('emits success postMessage with redirect=true and customer_session_token for external URL', async () => {
    await callHook({
      embed: true,
      listenFulfillment: vi.fn(() => Promise.resolve()),
      checkout: baseCheckout({
        embed_origin: EMBED_ORIGIN,
        success_url: 'https://merchant.example.com/thanks',
      }),
      customerSessionToken: 'tok_abc',
    })

    const [payload, origin] = successPostMessageCalls()[0]
    expect(origin).toBe(EMBED_ORIGIN)
    expect(payload).toMatchObject({ event: 'success', redirect: true })
    expect((payload as { successURL: string }).successURL).toContain(
      'customer_session_token=tok_abc',
    )
  })

  it('emits success postMessage with redirect=false for internal success URL', async () => {
    await callHook({
      embed: true,
      listenFulfillment: vi.fn(() => Promise.resolve()),
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
    })

    const [payload] = successPostMessageCalls()[0]
    expect(payload).toMatchObject({ event: 'success', redirect: false })
  })

  it('skips the wait and emits success immediately when listenFulfillment is omitted', async () => {
    await callHook({
      embed: true,
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
    })

    expect(successPostMessageCalls()).toHaveLength(1)
    expect(pushMock).toHaveBeenCalledTimes(1)
  })

  it('does not navigate the iframe for embed + external success URL (parent handles redirect)', async () => {
    await callHook({
      embed: true,
      listenFulfillment: vi.fn(() => Promise.resolve()),
      checkout: baseCheckout({
        embed_origin: EMBED_ORIGIN,
        success_url: 'https://merchant.example.com/thanks',
      }),
    })

    expect(pushMock).not.toHaveBeenCalled()
  })

  it('preserves customer_session_token in fallback URL on listenFulfillment timeout', async () => {
    await callHook({
      embed: true,
      listenFulfillment: vi.fn(() => Promise.reject(new Error('timeout'))),
      checkout: baseCheckout({ embed_origin: EMBED_ORIGIN }),
      customerSessionToken: 'tok_abc',
    })

    expect(pushMock.mock.calls[0][0]).toContain(
      'customer_session_token=tok_abc',
    )
  })
})
