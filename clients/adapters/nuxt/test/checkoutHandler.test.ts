import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.hoisted` makes the mock fns available to the `vi.mock` factories, which
// vitest hoists above ordinary top-level `const` declarations (so a plain
// `const` would hit a TDZ ReferenceError when the factory runs at import time).
const { mockCheckoutCreate, mockCheckoutUpdate, mockSendRedirect } = vi.hoisted(
  () => ({
    mockCheckoutCreate: vi.fn(),
    mockCheckoutUpdate: vi.fn(),
    mockSendRedirect: vi.fn(),
  }),
)

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolarCore: vi.fn(() => ({})),
}))

vi.mock('@polar-sh/sdk/2026-04/services/checkouts', () => ({
  createCheckouts: () => mockCheckoutCreate,
  clientUpdateCheckouts: () => mockCheckoutUpdate,
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    // `sendRedirect` writes response headers/status onto event.node.res,
    // which a unit-test fixture never has. Stub it so the handler's redirect
    // can be observed without a real Node response — and asserted by the
    // `redirect` suite below.
    sendRedirect: mockSendRedirect,
  }
})

import { createEvent } from 'h3'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Checkout } from '../src/runtime/server/checkoutHandler'

function makeEvent(url: string) {
  const req = { method: 'GET', url, headers: {} } as unknown as IncomingMessage
  const res = {} as unknown as ServerResponse
  return createEvent(req, res)
}

describe('Checkout', () => {
  beforeAll(() => {
    mockSendRedirect.mockResolvedValue(undefined)
  })

  beforeEach(() => {
    mockCheckoutCreate.mockClear()
    mockCheckoutUpdate.mockClear()
    mockSendRedirect.mockClear()
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://polar.sh/checkout/checkout_123',
    })
  })

  describe('URL escape preservation', () => {
    it.each([
      ['%2541', '%41'],
      ['%2500', '%00'],
      ['%7Bx%7D', '{x}'],
    ])('preserves URL escapes %s', async (encoded, decoded) => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: `https://example.com/success?data=${encoded}`,
        returnUrl: `https://example.com/return?data=${encoded}`,
        includeCheckoutId: true,
      })
      await checkout(makeEvent('/api/checkout?products=prod_123'))

      const { success_url, return_url } = mockCheckoutCreate.mock.calls[0][0]
      expect(success_url).toBe(
        `https://example.com/success?data=${encoded}&checkout_id={CHECKOUT_ID}`,
      )
      const page = new URL(success_url.replaceAll('{CHECKOUT_ID}', 'chk_123'))
      expect(page.searchParams.get('data')).toBe(decoded)
      expect(page.searchParams.get('checkout_id')).toBe('chk_123')
      expect(return_url).toBe(`https://example.com/return?data=${encoded}`)
      expect(new URL(return_url).searchParams.get('data')).toBe(decoded)
    })
  })

  describe('seats', () => {
    it('forwards seats to polar.checkouts.create when ?seats=5 is provided', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      const event = makeEvent('/api/checkout?products=prod_123&seats=5')
      await checkout(event)

      expect(mockCheckoutCreate).toHaveBeenCalledTimes(1)
      expect(mockCheckoutCreate.mock.calls[0][0]).toMatchObject({
        products: ['prod_123'],
        seats: 5,
      })
    })

    it('omits seats from the SDK call when ?seats is not provided', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      const event = makeEvent('/api/checkout?products=prod_123')
      await checkout(event)

      expect(mockCheckoutCreate).toHaveBeenCalledTimes(1)
      expect(mockCheckoutCreate.mock.calls[0][0].seats).toBeUndefined()
    })

    it('forwards seats=1', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      await checkout(makeEvent('/api/checkout?products=prod_123&seats=1'))

      expect(mockCheckoutCreate.mock.calls[0][0].seats).toBe(1)
    })

    it('forwards seats=0 (parity with nextjs: no positive/int guard)', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      await checkout(makeEvent('/api/checkout?products=prod_123&seats=0'))

      expect(mockCheckoutCreate.mock.calls[0][0].seats).toBe(0)
    })

    it('forwards NaN for non-numeric seats (parity with nextjs)', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })

      // Regression of the bug report's per-scenario contract: matches the
      // nextjs adapter (`Number.parseInt('garbage', 10)` -> NaN, forwarded)
      // rather than 422/500-ing on garbage input.
      await checkout(makeEvent('/api/checkout?products=prod_123&seats=garbage'))

      expect(Number.isNaN(mockCheckoutCreate.mock.calls[0][0].seats)).toBe(true)
    })
  })

  describe('products envelope parsing', () => {
    it.each([
      ['?products='],
      ['?products=prod_1,'],
      ['?products=prod_1,,prod_2'],
    ])(
      'rejects malformed %s with a 400 and does not forward to createCheckouts',
      async (query) => {
        const checkout = Checkout({ accessToken: 'test-token' })

        await expect(checkout(makeEvent(query))).rejects.toMatchObject({
          statusCode: 400,
        })
        expect(mockCheckoutCreate).not.toHaveBeenCalled()
      },
    )
  })

  describe('other query params (regression)', () => {
    it('forwards products, customer fields, allowDiscountCodes, discountId, and seats together', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      const url =
        '/api/checkout?products=prod_1,prod_2' +
        '&customer_id=cust_1' +
        '&external_customer_id=ext_1' +
        '&customer_email=test@example.com' +
        '&customer_name=Jane' +
        '&customer_tax_id=TAX1' +
        '&customer_ip_address=10.0.0.1' +
        '&allow_discount_codes=true' +
        '&discount_id=disc_1' +
        '&seats=3'

      await checkout(makeEvent(url))

      expect(mockCheckoutCreate.mock.calls[0][0]).toMatchObject({
        products: ['prod_1', 'prod_2'],
        customer_id: 'cust_1',
        external_customer_id: 'ext_1',
        customer_email: 'test@example.com',
        customer_name: 'Jane',
        customer_tax_id: 'TAX1',
        customer_ip_address: '10.0.0.1',
        allow_discount_codes: true,
        discount_id: 'disc_1',
        seats: 3,
      })
    })

    it('parses JSON customerBillingAddress, customerMetadata, and metadata, and forwards seats', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      const billing = encodeURIComponent(JSON.stringify({ country: 'US' }))
      const customerMetadata = encodeURIComponent(
        JSON.stringify({ plan: 'pro' }),
      )
      const metadata = encodeURIComponent(JSON.stringify({ ref: 'xyz' }))
      const url = `/api/checkout?products=prod_1&customer_billing_address=${billing}&customer_metadata=${customerMetadata}&metadata=${metadata}&seats=2`

      await checkout(makeEvent(url))

      expect(mockCheckoutCreate.mock.calls[0][0]).toMatchObject({
        customer_billing_address: { country: 'US' },
        customer_metadata: { plan: 'pro' },
        metadata: { ref: 'xyz' },
        seats: 2,
      })
    })

    it('treats allowDiscountCodes=false as boolean false', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      await checkout(
        makeEvent('/api/checkout?products=prod_123&allow_discount_codes=false'),
      )

      expect(mockCheckoutCreate.mock.calls[0][0].allow_discount_codes).toBe(
        false,
      )
    })
  })

  describe('redirect', () => {
    it.each([
      ['discount_code=SAVE%2B20%25', 'SAVE+20%', undefined],
      ['discount_code=SAVE20&discount_id=disc_123', undefined, 'disc_123'],
      ['discount_code=', undefined, undefined],
    ])('handles discount prefill for %s', async (query, code, discountId) => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
        client_secret: 'checkout_secret',
      })
      const checkout = Checkout({ accessToken: 'test-token', theme: 'dark' })
      await checkout(makeEvent(`/api/checkout?products=prod_123&${query}`))

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({ discount_id: discountId }),
      )
      if (code) {
        expect(mockCheckoutUpdate).toHaveBeenCalledExactlyOnceWith(
          'checkout_secret',
          { discount_code: code },
        )
      } else {
        expect(mockCheckoutUpdate).not.toHaveBeenCalled()
      }
      expect(mockSendRedirect.mock.calls[0][1]).toBe(
        'https://polar.sh/checkout/123?theme=dark',
      )
    })

    it('does not redirect when applying a discount code fails', async () => {
      mockCheckoutUpdate.mockRejectedValueOnce(
        new Error('Invalid discount code'),
      )
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const checkout = Checkout({ accessToken: 'test-token' })

      await expect(
        checkout(
          makeEvent('/api/checkout?products=prod_123&discount_code=INVALID'),
        ),
      ).rejects.toThrow('Invalid discount code')
      expect(mockSendRedirect).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('redirects to the URL returned by polar.checkouts.create', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      const event = makeEvent('/api/checkout?products=prod_123&seats=5')
      await checkout(event)

      expect(mockSendRedirect).toHaveBeenCalledTimes(1)
      const [redirectedEvent, location] = mockSendRedirect.mock.calls[0]
      // The same H3Event is forwarded to sendRedirect.
      expect(redirectedEvent).toBe(event)
      expect(location).toBe('https://polar.sh/checkout/checkout_123')
    })

    it('appends theme to the redirect URL when configured', async () => {
      const checkout = Checkout({ accessToken: 'test-token', theme: 'dark' })
      await checkout(makeEvent('/api/checkout?products=prod_123&seats=5'))

      expect(mockSendRedirect.mock.calls[0][1]).toBe(
        'https://polar.sh/checkout/checkout_123?theme=dark',
      )
    })

    it('embeds checkoutId into the configured successUrl', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success',
        includeCheckoutId: true,
      })
      await checkout(makeEvent('/api/checkout?products=prod_123&seats=5'))

      expect(mockCheckoutCreate.mock.calls[0][0].success_url).toBe(
        'https://example.com/success?checkout_id={CHECKOUT_ID}',
      )
    })
  })

  describe('error handling', () => {
    it('rethrows as an h3 error (500) when checkout creation fails', async () => {
      mockCheckoutCreate.mockRejectedValueOnce(new Error('API Error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const checkout = Checkout({ accessToken: 'test-token' })

      await expect(
        checkout(makeEvent('/api/checkout?products=prod_123&seats=5')),
      ).rejects.toThrow('API Error')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
