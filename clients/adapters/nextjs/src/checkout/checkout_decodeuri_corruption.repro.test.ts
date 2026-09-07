import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckoutCreate = vi.fn()

vi.mock('@polar-sh/sdk', () => ({
  Polar: vi.fn(function () {
    return {
      checkouts: {
        create: mockCheckoutCreate,
      },
    }
  }),
}))

import { Checkout } from './checkout'

/**
 * Reproduces the `decodeURI` over-decoding regression in the Next.js Checkout adapter.
 *
 * The adapter previously wrapped the merchant-configured successUrl/returnUrl in
 * `decodeURI(url.toString())`. `decodeURI` strips one encoding layer from the
 * *entire* URL, not just the `%7B`/`%7D` it adds around `{CHECKOUT_ID}`, so any
 * `%25`-prefixed literal the merchant statically encoded (a literal `%` followed by
 * hex digits that the success page should receive verbatim) lost a layer and arrived
 * as the decoded character.
 *
 * `simulateServerThenSuccessPageRead` mirrors the server-side pipeline the wire value
 * flows through so we can assert what the merchant's success page actually reads:
 *   1. `SuccessUrl` (a pydantic `HttpUrl` in server/polar/kit/http.py) stores valid
 *      percent-escapes verbatim, then unescapes `%7BCHECKOUT_ID%7D` -> `{CHECKOUT_ID}`.
 *   2. `polar.models.checkout.Checkout` replaces every `{CHECKOUT_ID}` with the id.
 *   3. The merchant's success page reads query params via `URLSearchParams.get(...)`.
 *
 * Run: pnpm --filter @polar-sh/nextjs exec vitest run src/checkout/checkout_decodeuri_corruption.repro.test.ts
 */

const CHECKOUT_ID = 'chk_123'

function simulateServerThenSuccessPageRead(wireUrl: string) {
  // Step 1 (server): SuccessUrl validator stores verbatim for valid %-escapes and
  // unescapes the %7BCHECKOUT_ID%7D placeholder back to {CHECKOUT_ID}. The adapter
  // already passes {CHECKOUT_ID} (not %7BCHECKOUT_ID%7D), so this is a verbatim store.
  const stored = wireUrl
  // Step 2 (model): Checkout.success_url.replace("{CHECKOUT_ID}", self.id) — Python's
  // str.replace substitutes *all* occurrences.
  const afterSubstitution = stored.replaceAll('{CHECKOUT_ID}', CHECKOUT_ID)
  // Step 3 (merchant): the success page parses the redirected URL.
  return new URL(afterSubstitution)
}

describe('Checkout successUrl/returnUrl percent-escape preservation (decodeURI regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckoutCreate.mockResolvedValue({
      url: 'https://polar.sh/checkout/123',
    })
  })

  const buildRequest = () =>
    new NextRequest('https://example.com/checkout?products=prod_123')

  const getCreateCall = () => mockCheckoutCreate.mock.calls[0][0]

  describe('successUrl', () => {
    it('preserves a %25-prefixed literal so the success page reads %41 (not "A")', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success?data=%2541',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      // The %2541 the merchant configured must survive intact on the wire.
      expect(wire).toBe(
        'https://example.com/success?data=%2541&checkoutId={CHECKOUT_ID}',
      )

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('data')).toBe('%41')
      expect(page.searchParams.get('checkoutId')).toBe(CHECKOUT_ID)
    })

    it('preserves a %25-prefixed NUL literal so the success page reads %00 (not "\\u0000")', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success?data=%2500',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      expect(wire).toBe(
        'https://example.com/success?data=%2500&checkoutId={CHECKOUT_ID}',
      )

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('data')).toBe('%00')
      expect(page.searchParams.get('checkoutId')).toBe(CHECKOUT_ID)
    })

    it('preserves a literal percent embedded in a value (50%25off -> 50%off)', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success?discount=50%25off',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      expect(wire).toBe(
        'https://example.com/success?discount=50%25off&checkoutId={CHECKOUT_ID}',
      )

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('discount')).toBe('50%off')
    })

    it('does not over-decode reserved-character escapes (%7Bx%7D -> {x} at the page)', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success?data=%7Bx%7D',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      // The merchant's %7Bx%7D must be preserved on the wire, not decoded to {x}.
      expect(wire).toBe(
        'https://example.com/success?data=%7Bx%7D&checkoutId={CHECKOUT_ID}',
      )

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('data')).toBe('{x}')
    })

    it('preserves a URL-as-a-value with reserved chars (https%3A%2F%2Fexample.com)', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success?url=https%3A%2F%2Fexample.com',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      expect(wire).toBe(
        'https://example.com/success?url=https%3A%2F%2Fexample.com&checkoutId={CHECKOUT_ID}',
      )

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('url')).toBe('https://example.com')
    })

    it('preserves a percent-encoded space in the path (my%20path)', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/my%20path/success',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      expect(wire).toBe(
        'https://example.com/my%20path/success?checkoutId={CHECKOUT_ID}',
      )
      expect(wire).not.toContain('my path')

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.pathname).toBe('/my%20path/success')
    })

    it('keeps the {CHECKOUT_ID} placeholder literal on the wire (server substitutes it)', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      // Backwards-compatible guarantee: the placeholder is the literal token, not
      // %7BCHECKOUT_ID%7D (the server unescapes that too, but we keep the wire form).
      expect(wire).toBe('https://example.com/success?checkoutId={CHECKOUT_ID}')

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('checkoutId')).toBe(CHECKOUT_ID)
    })

    it('does not add checkoutId when includeCheckoutId is false', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success?data=%2541',
        includeCheckoutId: false,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().successUrl as string
      expect(wire).toBe('https://example.com/success?data=%2541')

      const page = simulateServerThenSuccessPageRead(wire)
      expect(page.searchParams.get('data')).toBe('%41')
      expect(page.searchParams.has('checkoutId')).toBe(false)
    })
  })

  describe('returnUrl', () => {
    it('preserves a %25-prefixed literal on returnUrl (not just successUrl)', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success',
        returnUrl: 'https://example.com/return?data=%2541',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().returnUrl as string
      expect(wire).toBe('https://example.com/return?data=%2541')

      // returnUrl is stored verbatim and read back at the return page.
      const page = new URL(wire)
      expect(page.searchParams.get('data')).toBe('%41')
    })

    it('does not over-decode reserved-character escapes on returnUrl', async () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        returnUrl: 'https://example.com/return?data=%7Bx%7D',
        includeCheckoutId: true,
      })

      await checkout(buildRequest())

      const wire = getCreateCall().returnUrl as string
      expect(wire).toBe('https://example.com/return?data=%7Bx%7D')
    })
  })
})
