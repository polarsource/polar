import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { subscriptionFixture } from '../test-utils/fixtures'
import { server } from '../test-utils/server'
import { createPortalClient } from './client'
import { PolarCustomerPortalError } from './errors'
import { createSubscriptionMethods } from './subscriptions'

const API_BASE = 'http://example.com:8000'

describe('subscription methods', () => {
  const createClient = () => {
    const portalClient = createPortalClient({
      token: 'test_token',
      organizationId: 'org_123',
      baseUrl: API_BASE,
    })
    return createSubscriptionMethods(portalClient)
  }

  describe('getSubscriptions', () => {
    it('fetches all subscriptions', async () => {
      const mockSubscriptions = [
        subscriptionFixture({ id: 'sub-1', status: 'active' }),
        subscriptionFixture({ id: 'sub-2', status: 'canceled' }),
      ]

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/`, () => {
          return HttpResponse.json({
            items: mockSubscriptions,
            pagination: { total_count: 2, page: 1, limit: 10 },
          })
        }),
      )

      const methods = createClient()
      const subscriptions = await methods.getSubscriptions()

      expect(subscriptions).toHaveLength(2)
      expect(subscriptions[0].id).toBe('sub-1')
      expect(subscriptions[1].id).toBe('sub-2')
    })

    it('fetches subscriptions with filters', async () => {
      const mockSubscriptions = [
        subscriptionFixture({ id: 'sub-1', status: 'active' }),
      ]

      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/`,
          ({ request }) => {
            const url = new URL(request.url)
            expect(url.searchParams.get('active')).toBe('true')
            return HttpResponse.json({
              items: mockSubscriptions,
              pagination: { total_count: 1, page: 1, limit: 10 },
            })
          },
        ),
      )

      const methods = createClient()
      const subscriptions = await methods.getSubscriptions({ active: true })

      expect(subscriptions).toHaveLength(1)
      expect(subscriptions[0].status).toBe('active')
    })

    it('throws PolarCustomerPortalError on error', async () => {
      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/`, () => {
          return HttpResponse.json(
            { detail: 'Internal error' },
            { status: 500 },
          )
        }),
      )

      const methods = createClient()

      await expect(methods.getSubscriptions()).rejects.toThrow(
        PolarCustomerPortalError,
      )
    })
  })

  describe('getSubscription', () => {
    it('fetches a single subscription by id', async () => {
      const mockSubscription = subscriptionFixture({ id: 'sub-123' })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
      )

      const methods = createClient()
      const subscription = await methods.getSubscription('sub-123')

      expect(subscription.id).toBe('sub-123')
    })

    it('throws PolarCustomerPortalError on not found', async () => {
      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/nonexistent`,
          () => {
            return HttpResponse.json(
              { detail: 'Subscription not found' },
              { status: 404 },
            )
          },
        ),
      )

      const methods = createClient()

      await expect(methods.getSubscription('nonexistent')).rejects.toThrow(
        PolarCustomerPortalError,
      )
    })
  })

  describe('cancelSubscription', () => {
    it('schedules cancellation at period end', async () => {
      const canceledSubscription = subscriptionFixture({
        id: 'sub-123',
        cancel_at_period_end: true,
      })

      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.cancel_at_period_end).toBe(true)
            return HttpResponse.json(canceledSubscription)
          },
        ),
      )

      const methods = createClient()
      const result = await methods.cancelSubscription('sub-123')

      expect(result.cancel_at_period_end).toBe(true)
    })

    it('cancels with reason and comment', async () => {
      const canceledSubscription = subscriptionFixture({
        id: 'sub-123',
        cancel_at_period_end: true,
        customer_cancellation_reason: 'too_expensive',
        customer_cancellation_comment: 'Too pricey for me',
      })

      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.cancel_at_period_end).toBe(true)
            expect(body.cancellation_reason).toBe('too_expensive')
            expect(body.cancellation_comment).toBe('Too pricey for me')
            return HttpResponse.json(canceledSubscription)
          },
        ),
      )

      const methods = createClient()
      const result = await methods.cancelSubscription('sub-123', {
        cancellation_reason: 'too_expensive',
        cancellation_comment: 'Too pricey for me',
      })

      expect(result.cancel_at_period_end).toBe(true)
      expect(result.customer_cancellation_reason).toBe('too_expensive')
    })

    it('throws PolarCustomerPortalError on already canceled', async () => {
      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          () => {
            return HttpResponse.json(
              { detail: 'Subscription already canceled' },
              { status: 403 },
            )
          },
        ),
      )

      const methods = createClient()

      await expect(methods.cancelSubscription('sub-123')).rejects.toThrow(
        PolarCustomerPortalError,
      )
    })
  })

  describe('uncancelSubscription', () => {
    it('removes scheduled cancellation', async () => {
      const uncanceledSubscription = subscriptionFixture({
        id: 'sub-123',
        cancel_at_period_end: false,
        customer_cancellation_reason: null,
        customer_cancellation_comment: null,
      })

      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.cancel_at_period_end).toBe(false)
            expect(body.cancellation_reason).toBeNull()
            expect(body.cancellation_comment).toBeNull()
            return HttpResponse.json(uncanceledSubscription)
          },
        ),
      )

      const methods = createClient()
      const result = await methods.uncancelSubscription('sub-123')

      expect(result.cancel_at_period_end).toBe(false)
    })

    it('throws PolarCustomerPortalError on not found', async () => {
      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/nonexistent`,
          () => {
            return HttpResponse.json(
              { detail: 'Subscription not found' },
              { status: 404 },
            )
          },
        ),
      )

      const methods = createClient()

      await expect(methods.uncancelSubscription('nonexistent')).rejects.toThrow(
        PolarCustomerPortalError,
      )
    })
  })

  describe('updateSubscription', () => {
    it('updates subscription to a different product', async () => {
      const updatedSubscription = subscriptionFixture({
        id: 'sub-123',
        product_id: 'product-new',
      })

      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.product_id).toBe('product-new')
            return HttpResponse.json(updatedSubscription)
          },
        ),
      )

      const methods = createClient()
      const result = await methods.updateSubscription('sub-123', {
        product_id: 'product-new',
      })

      expect(result.product_id).toBe('product-new')
    })

    it('updates subscription seats', async () => {
      const updatedSubscription = subscriptionFixture({ id: 'sub-123' })

      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.seats).toBe(5)
            return HttpResponse.json(updatedSubscription)
          },
        ),
      )

      const methods = createClient()
      await methods.updateSubscription('sub-123', { seats: 5 })
    })

    it('throws PolarCustomerPortalError on validation error', async () => {
      server.use(
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          () => {
            return HttpResponse.json(
              { detail: 'Validation error' },
              { status: 422 },
            )
          },
        ),
      )

      const methods = createClient()

      await expect(
        methods.updateSubscription('sub-123', { product_id: 'invalid' }),
      ).rejects.toThrow(PolarCustomerPortalError)
    })
  })

  describe('getChargePreview', () => {
    it('fetches charge preview for a subscription', async () => {
      const mockPreview = {
        base_amount: 1000,
        metered_amount: 500,
        subtotal_amount: 1500,
        discount_amount: 100,
        tax_amount: 150,
        total_amount: 1550,
      }

      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockPreview)
          },
        ),
      )

      const methods = createClient()
      const preview = await methods.getChargePreview('sub-123')

      expect(preview.base_amount).toBe(1000)
      expect(preview.total_amount).toBe(1550)
    })

    it('throws PolarCustomerPortalError on not found', async () => {
      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/nonexistent/charge-preview`,
          () => {
            return HttpResponse.json(
              { detail: 'Subscription not found' },
              { status: 404 },
            )
          },
        ),
      )

      const methods = createClient()

      await expect(methods.getChargePreview('nonexistent')).rejects.toThrow(
        PolarCustomerPortalError,
      )
    })
  })
})
