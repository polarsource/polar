import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCustomerSessionCreate = vi.fn()

vi.mock('@polar-sh/sdk/2026-04', () => ({
  createPolarCore: vi.fn(() => ({})),
}))

vi.mock('@polar-sh/sdk/2026-04/services/customer_sessions', () => ({
  createCustomerSessions: vi.fn(() => mockCustomerSessionCreate),
}))

import { createPolarCore } from '@polar-sh/sdk/2026-04'
import { CustomerPortal } from './customerPortal'

describe('CustomerPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('configuration', () => {
    it('should create portal function', () => {
      const getCustomerId = vi.fn()
      const portal = CustomerPortal({
        accessToken: 'test-token',
        getCustomerId,
      })

      expect(portal).toBeDefined()
      expect(typeof portal).toBe('function')
      expect(createPolarCore).toHaveBeenCalledWith({
        accessToken: 'test-token',
        environment: undefined,
      })
    })
  })

  describe('request handling', () => {
    it('should return 400 when customerId is not provided', async () => {
      const getCustomerId = vi.fn().mockResolvedValue('')
      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getCustomerId,
      })

      const request = new NextRequest('https://example.com/portal')
      const response = await portal(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('customerId not defined')
      expect(getCustomerId).toHaveBeenCalledWith(request)
    })

    it('should return 400 when customerId is null', async () => {
      const getCustomerId = vi.fn().mockResolvedValue(null)
      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getCustomerId,
      })

      const request = new NextRequest('https://example.com/portal')
      const response = await portal(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('customerId not defined')
    })

    it('should create customer session and redirect when customerId is valid', async () => {
      const getCustomerId = vi.fn().mockResolvedValue('cust_123')
      mockCustomerSessionCreate.mockResolvedValue({
        customer_portal_url: 'https://polar.sh/portal/session_123',
      })

      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getCustomerId,
      })

      const request = new NextRequest('https://example.com/portal')
      const response = await portal(request)

      expect(getCustomerId).toHaveBeenCalledWith(request)
      expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
        customer_id: 'cust_123',
        return_url: undefined,
      })
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'https://polar.sh/portal/session_123',
      )
    })

    it('should create customer session and redirect when externalCustomerId is valid', async () => {
      const getExternalCustomerId = vi.fn().mockResolvedValue('external_123')
      mockCustomerSessionCreate.mockResolvedValue({
        customer_portal_url: 'https://polar.sh/portal/session_123',
      })

      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getExternalCustomerId,
      })

      const request = new NextRequest('https://example.com/portal')
      const response = await portal(request)

      expect(getExternalCustomerId).toHaveBeenCalledWith(request)
      expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
        external_customer_id: 'external_123',
        return_url: undefined,
      })
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'https://polar.sh/portal/session_123',
      )
    })

    it('should handle customer session creation failure', async () => {
      const getCustomerId = vi.fn().mockResolvedValue('cust_123')
      mockCustomerSessionCreate.mockRejectedValue(new Error('API Error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getCustomerId,
      })

      const request = new NextRequest('https://example.com/portal')
      const response = await portal(request)

      expect(response).toBeDefined()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle async getCustomerId function', async () => {
      const getCustomerId = vi.fn().mockImplementation(async (req) => {
        const url = new URL(req.url)
        return url.searchParams.get('userId') || ''
      })

      mockCustomerSessionCreate.mockResolvedValue({
        customer_portal_url: 'https://polar.sh/portal/session_456',
      })

      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'sandbox',
        getCustomerId,
      })

      const request = new NextRequest(
        'https://example.com/portal?userId=user_456',
      )
      const response = await portal(request)

      expect(getCustomerId).toHaveBeenCalledWith(request)
      expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
        customer_id: 'user_456',
        return_url: undefined,
      })
      expect(response.status).toBe(307)
    })

    it('should handle getCustomerId throwing an error', async () => {
      const getCustomerId = vi.fn().mockRejectedValue(new Error('Auth error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const portal = CustomerPortal({
        accessToken: 'test-token',
        environment: 'production',
        getCustomerId,
      })

      const request = new NextRequest('https://example.com/portal')

      await expect(portal(request)).rejects.toThrow('Auth error')

      consoleSpy.mockRestore()
    })
  })
})
