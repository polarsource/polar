import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCheckoutCreate = vi.fn()

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolar: vi.fn(() => ({
    checkouts: {
      create: mockCheckoutCreate,
    },
  })),
}))

import { createPolar } from '@polar-sh/sdk/2026-04'
import { Checkout } from './checkout'

describe('Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('configuration', () => {
    it('should create checkout function', () => {
      const checkout = Checkout({
        accessToken: 'test-token',
        environment: 'sandbox',
      })

      expect(checkout).toBeDefined()
      expect(typeof checkout).toBe('function')
      expect(createPolar).toHaveBeenCalledWith({
        accessToken: 'test-token',
        environment: 'sandbox',
      })
    })

    it('should handle default includeCheckoutId', () => {
      const checkout = Checkout({
        accessToken: 'test-token',
      })

      expect(checkout).toBeDefined()
    })
  })

  describe('request handling', () => {
    it('should return 400 when no products provided', async () => {
      const checkout = Checkout({ accessToken: 'test-token' })
      const request = new NextRequest('https://example.com/checkout')

      const response = await checkout(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing products in query params')
    })

    it('should create checkout with single product', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({ accessToken: 'test-token' })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123',
      )

      const response = await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith({
        products: ['prod_123'],
        success_url: undefined,
        customer_id: undefined,
        external_customer_id: undefined,
        customer_email: undefined,
        customer_name: undefined,
        customer_billing_address: undefined,
        customer_tax_id: undefined,
        customer_ip_address: undefined,
        customer_metadata: undefined,
        allow_discount_codes: undefined,
        discount_id: undefined,
        metadata: undefined,
        seats: undefined,
        return_url: undefined,
      })
      expect(response.status).toBe(307)
    })

    it('should create checkout with multiple products', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({ accessToken: 'test-token' })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123&products=prod_456',
      )

      await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          products: ['prod_123', 'prod_456'],
        }),
      )
    })

    it('should include successUrl with checkoutId when configured', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success',
        includeCheckoutId: true,
      })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123',
      )

      await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://example.com/success?checkoutId={CHECKOUT_ID}',
        }),
      )
    })

    it('should include successUrl without checkoutId when disabled', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({
        accessToken: 'test-token',
        successUrl: 'https://example.com/success',
        includeCheckoutId: false,
      })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123',
      )

      await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://example.com/success',
        }),
      )
    })

    it('should add theme parameter to redirect URL', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({
        accessToken: 'test-token',
        theme: 'dark',
      })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123',
      )

      const response = await checkout(request)

      expect(response.headers.get('location')).toBe(
        'https://polar.sh/checkout/123?theme=dark',
      )
    })

    it('should parse customer parameters correctly', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({ accessToken: 'test-token' })
      const billingAddress = JSON.stringify({
        street: '123 Main St',
        city: 'NYC',
      })
      const metadata = JSON.stringify({ source: 'website' })
      const customerMetadata = JSON.stringify({ plan: 'premium' })

      const requestUrl = new URL('https://example.com/checkout')
      requestUrl.searchParams.set('products', 'prod_123')
      requestUrl.searchParams.set('customerId', 'cust_123')
      requestUrl.searchParams.set('customerExternalId', 'ext_123')
      requestUrl.searchParams.set('customerEmail', 'test@example.com')
      requestUrl.searchParams.set('customerName', 'John Doe')
      requestUrl.searchParams.set('customerBillingAddress', billingAddress)
      requestUrl.searchParams.set('customerTaxId', 'TAX123')
      requestUrl.searchParams.set('customerIpAddress', '192.168.1.1')
      requestUrl.searchParams.set('customerMetadata', customerMetadata)
      requestUrl.searchParams.set('allowDiscountCodes', 'true')
      requestUrl.searchParams.set('discountId', 'disc_123')
      requestUrl.searchParams.set('metadata', metadata)

      const request = new NextRequest(requestUrl.toString())

      await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith({
        products: ['prod_123'],
        success_url: undefined,
        customer_id: 'cust_123',
        external_customer_id: 'ext_123',
        customer_email: 'test@example.com',
        customer_name: 'John Doe',
        customer_billing_address: { street: '123 Main St', city: 'NYC' },
        customer_tax_id: 'TAX123',
        customer_ip_address: '192.168.1.1',
        customer_metadata: { plan: 'premium' },
        allow_discount_codes: true,
        discount_id: 'disc_123',
        metadata: { source: 'website' },
        seats: undefined,
        return_url: undefined,
      })
    })

    it('should handle allowDiscountCodes as false', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({ accessToken: 'test-token' })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123&allowDiscountCodes=false',
      )

      await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          allow_discount_codes: false,
        }),
      )
    })

    it('should handle seats parameter', async () => {
      mockCheckoutCreate.mockResolvedValue({
        url: 'https://polar.sh/checkout/123',
      })

      const checkout = Checkout({ accessToken: 'test-token' })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123&seats=5',
      )

      await checkout(request)

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          seats: 5,
        }),
      )
    })

    it('should return error response when checkout creation fails', async () => {
      mockCheckoutCreate.mockRejectedValue(new Error('API Error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const checkout = Checkout({ accessToken: 'test-token' })
      const request = new NextRequest(
        'https://example.com/checkout?products=prod_123',
      )

      const response = await checkout(request)

      expect(response).toBeDefined()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
