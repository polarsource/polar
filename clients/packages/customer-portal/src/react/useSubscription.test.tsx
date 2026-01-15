import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { subscriptionFixture } from '../test-utils/fixtures'
import { createWrapper } from '../test-utils/render'
import { server } from '../test-utils/server'
import { useSubscription } from './useSubscription'

const API_BASE = 'http://example.com:8000'

const mockChargePreview = {
  base_amount: 1000,
  metered_amount: 0,
  subtotal_amount: 1000,
  discount_amount: 0,
  tax_amount: 100,
  total_amount: 1100,
}

describe('useSubscription', () => {
  describe('query', () => {
    it('fetches a single subscription', async () => {
      const mockSubscription = subscriptionFixture({ id: 'sub-123' })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.id).toBe('sub-123')
    })

    it('uses initialData without fetching', async () => {
      const initialSubscription = subscriptionFixture({
        id: 'initial-sub',
        status: 'canceled',
      })

      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/initial-sub`,
          () => {
            return HttpResponse.json(initialSubscription)
          },
        ),
      )

      const { result } = renderHook(
        () =>
          useSubscription('initial-sub', {
            initialData: initialSubscription,
          }),
        { wrapper: createWrapper({ baseUrl: API_BASE }) },
      )

      expect(result.current.isLoading).toBe(false)
      expect(result.current.data?.id).toBe('initial-sub')
    })

    it('handles errors', async () => {
      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/not-found`,
          () => {
            return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('not-found'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeDefined()
    })
  })

  describe('chargePreview', () => {
    it('fetches charge preview for active subscription', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
      })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data?.status).toBe('active')
      })

      await waitFor(() => {
        expect(result.current.chargePreview.data).toBeDefined()
      })

      expect(result.current.chargePreview.data?.total_amount).toBe(1100)
    })

    it('does not fetch charge preview for canceled subscription', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-canceled',
        status: 'canceled',
      })

      let chargePreviewCalled = false
      server.use(
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-canceled`,
          () => {
            return HttpResponse.json(mockSubscription)
          },
        ),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-canceled/charge-preview`,
          () => {
            chargePreviewCalled = true
            return HttpResponse.json({})
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-canceled'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data?.status).toBe('canceled')
      })

      // Give it some time to potentially call the charge preview endpoint
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(chargePreviewCalled).toBe(false)
      expect(result.current.chargePreview.data).toBeUndefined()
    })
  })

  describe('cancel mutation', () => {
    it('cancels subscription at period end', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        cancel_at_period_end: false,
      })
      const canceledSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        cancel_at_period_end: true,
      })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.cancel_at_period_end).toBe(true)
            return HttpResponse.json(canceledSubscription)
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      expect(result.current.data?.cancel_at_period_end).toBe(false)

      await result.current.cancel.mutateAsync({})

      await waitFor(() => {
        expect(result.current.data?.cancel_at_period_end).toBe(true)
      })
    })

    it('cancels with reason and comment', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
      })
      const canceledSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        cancel_at_period_end: true,
        customer_cancellation_reason: 'too_expensive',
        customer_cancellation_comment: 'Too pricey',
      })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.cancel_at_period_end).toBe(true)
            expect(body.cancellation_reason).toBe('too_expensive')
            expect(body.cancellation_comment).toBe('Too pricey')
            return HttpResponse.json(canceledSubscription)
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      await result.current.cancel.mutateAsync({
        cancellation_reason: 'too_expensive',
        cancellation_comment: 'Too pricey',
      })

      await waitFor(() => {
        expect(result.current.data?.customer_cancellation_reason).toBe(
          'too_expensive',
        )
      })
    })
  })

  describe('uncancel mutation', () => {
    it('removes scheduled cancellation', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        cancel_at_period_end: true,
        customer_cancellation_reason: 'too_expensive',
      })
      const uncanceledSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        cancel_at_period_end: false,
        customer_cancellation_reason: null,
        customer_cancellation_comment: null,
      })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
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

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      expect(result.current.data?.cancel_at_period_end).toBe(true)

      await result.current.uncancel.mutateAsync()

      await waitFor(() => {
        expect(result.current.data?.cancel_at_period_end).toBe(false)
      })
    })
  })

  describe('update mutation', () => {
    it('updates subscription product', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        product_id: 'product-old',
      })
      const updatedSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
        product_id: 'product-new',
      })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.product_id).toBe('product-new')
            return HttpResponse.json(updatedSubscription)
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      expect(result.current.data?.product_id).toBe('product-old')

      await result.current.update.mutateAsync({ product_id: 'product-new' })

      await waitFor(() => {
        expect(result.current.data?.product_id).toBe('product-new')
      })
    })

    it('updates subscription seats', async () => {
      const mockSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
      })
      const updatedSubscription = subscriptionFixture({
        id: 'sub-123',
        status: 'active',
      })

      server.use(
        http.get(`${API_BASE}/v1/customer-portal/subscriptions/sub-123`, () => {
          return HttpResponse.json(mockSubscription)
        }),
        http.get(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123/charge-preview`,
          () => {
            return HttpResponse.json(mockChargePreview)
          },
        ),
        http.patch(
          `${API_BASE}/v1/customer-portal/subscriptions/sub-123`,
          async ({ request }) => {
            const body = (await request.json()) as Record<string, unknown>
            expect(body.seats).toBe(10)
            return HttpResponse.json(updatedSubscription)
          },
        ),
      )

      const { result } = renderHook(() => useSubscription('sub-123'), {
        wrapper: createWrapper({ baseUrl: API_BASE }),
      })

      await waitFor(() => {
        expect(result.current.data).toBeDefined()
      })

      await result.current.update.mutateAsync({ seats: 10 })

      await waitFor(() => {
        expect(result.current.update.isSuccess).toBe(true)
      })
    })
  })
})
