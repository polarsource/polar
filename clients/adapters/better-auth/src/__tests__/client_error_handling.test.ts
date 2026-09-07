import { createFetch } from '@better-fetch/fetch'
import type { BetterFetchOption } from 'better-auth/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { polarClient } from '../client'

vi.mock('@polar-sh/checkout/embed', () => ({
  PolarEmbedCheckout: { create: vi.fn().mockResolvedValue({}) },
}))

import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'

const ORIGIN = 'http://localhost:3000'
const CHECKOUT_URL = `${ORIGIN}/checkout/test-123`

beforeAll(() => {
  ;(globalThis as any).window = { location: { origin: ORIGIN } }
})

afterAll(() => {
  delete (globalThis as any).window
})

function makeActions($fetch: unknown) {
  return polarClient().getActions!($fetch as any)
}

async function catchFrom(
  fn: () => Promise<unknown>,
): Promise<{ error: unknown; message: string; status: unknown }> {
  let error: unknown
  try {
    await fn()
  } catch (e) {
    error = e
  }
  return {
    error,
    message: (error as Error)?.message,
    status: (error as any)?.status,
  }
}

describe('checkoutEmbed error handling', () => {
  describe('default throw path (mocked $fetch)', () => {
    it('surfaces `${status} ${statusText}` when res.error has no message field', async () => {
      const $fetch = vi.fn().mockResolvedValue({
        data: null,
        error: { status: 502, statusText: 'Bad Gateway' },
      })
      const { error, message, status } = await catchFrom(() =>
        makeActions($fetch).checkoutEmbed({ products: ['p1'] }),
      )

      expect(error).toBeInstanceOf(Error)
      expect(message).toBe('502 Bad Gateway')
      expect(status).toBeUndefined()
    })

    it('preserves res.error.message when present', async () => {
      const $fetch = vi.fn().mockResolvedValue({
        data: null,
        error: {
          status: 400,
          statusText: 'Bad Request',
          message: 'Checkout creation failed',
        },
      })
      const { error, message } = await catchFrom(() =>
        makeActions($fetch).checkoutEmbed({ products: ['p1'] }),
      )

      expect(error).toBeInstanceOf(Error)
      expect(message).toBe('Checkout creation failed')
    })
  })

  describe('happy path (mocked $fetch)', () => {
    it('opens the returned checkout URL with default light theme', async () => {
      const create = vi.mocked(PolarEmbedCheckout.create)
      create.mockClear()
      const $fetch = vi.fn().mockResolvedValue({
        data: { url: CHECKOUT_URL },
        error: null,
      })

      const result = await makeActions($fetch).checkoutEmbed({
        products: ['p1'],
      })

      expect($fetch).toHaveBeenCalledWith(
        '/checkout',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            products: ['p1'],
            redirect: false,
            embedOrigin: ORIGIN,
          }),
        }),
      )
      expect(create).toHaveBeenCalledWith(CHECKOUT_URL, { theme: 'light' })
      expect(result).toEqual({})
    })

    it('honors the theme encoded in the checkout URL', async () => {
      const create = vi.mocked(PolarEmbedCheckout.create)
      create.mockClear()
      const url = `${CHECKOUT_URL}?theme=dark`
      const $fetch = vi.fn().mockResolvedValue({
        data: { url },
        error: null,
      })

      await makeActions($fetch).checkoutEmbed({ products: ['p1'] })

      expect(create).toHaveBeenCalledWith(url, { theme: 'dark' })
    })
  })

  describe('end-to-end with real @better-fetch/fetch', () => {
    let originalFetch: typeof globalThis.fetch

    beforeAll(() => {
      originalFetch = globalThis.fetch
    })

    afterAll(() => {
      globalThis.fetch = originalFetch
    })

    function makeRealFetch(body: BodyInit | null, init: ResponseInit) {
      const mock = vi.fn().mockResolvedValue(new Response(body, init))
      globalThis.fetch = mock as any
      return {
        $fetch: createFetch({
          baseURL: `${ORIGIN}/api/auth`,
          method: 'GET',
          credentials: 'include',
          customFetchImpl: mock as any,
        }),
        restore: () => mock.mockRestore(),
      }
    }

    it('non-JSON 502 yields a thrown Error whose message is "502 Bad Gateway"', async () => {
      const { $fetch, restore } = makeRealFetch(
        '<html><body>502 Bad Gateway</body></html>',
        {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html' },
        },
      )
      const { error, message } = await catchFrom(() =>
        makeActions($fetch).checkoutEmbed({ products: ['p1'] }),
      )
      restore()

      expect(error).toBeInstanceOf(Error)
      expect(message).toBe('502 Bad Gateway')
    })

    it('empty-body 500 yields "500 Internal Server Error"', async () => {
      const { $fetch, restore } = makeRealFetch(null, {
        status: 500,
        statusText: 'Internal Server Error',
      })
      const { message } = await catchFrom(() =>
        makeActions($fetch).checkoutEmbed({ products: ['p1'] }),
      )
      restore()

      expect(message).toBe('500 Internal Server Error')
    })

    it('JSON error body with message preserves the message through @better-fetch/fetch', async () => {
      const mock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Checkout creation failed' }), {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      globalThis.fetch = mock as any
      const $fetch = createFetch({
        baseURL: `${ORIGIN}/api/auth`,
        method: 'GET',
        credentials: 'include',
        customFetchImpl: mock as any,
      })
      const { message } = await catchFrom(() =>
        makeActions($fetch).checkoutEmbed({ products: ['p1'] }),
      )
      mock.mockRestore()

      expect(message).toBe('Checkout creation failed')
    })

    it('{ throw: true } opt-in surfaces statusText and status on the thrown BetterFetchError', async () => {
      const mock = vi.fn().mockResolvedValue(
        new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      globalThis.fetch = mock as any
      const $fetch = createFetch({
        baseURL: `${ORIGIN}/api/auth`,
        method: 'GET',
        credentials: 'include',
        customFetchImpl: mock as any,
      })
      const { error, message, status } = await catchFrom(() =>
        makeActions($fetch).checkoutEmbed(
          { products: ['p1'] } as any,
          { throw: true } as BetterFetchOption,
        ),
      )
      mock.mockRestore()

      expect(error).toBeInstanceOf(Error)
      expect(message).toBe('Bad Gateway')
      expect(status).toBe(502)
    })
  })
})
