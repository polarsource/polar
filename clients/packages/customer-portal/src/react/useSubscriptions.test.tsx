import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { subscriptionFixture } from '../test-utils/fixtures'
import { createWrapper } from '../test-utils/render'
import { server } from '../test-utils/server'
import { useSubscriptions } from './useSubscriptions'

const API_BASE = 'http://example.com:8000'

describe('useSubscriptions', () => {
  it('fetches subscriptions', async () => {
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

    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: createWrapper({ baseUrl: API_BASE }),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].id).toBe('sub-1')
    expect(result.current.data?.[1].id).toBe('sub-2')
  })

  it('fetches subscriptions with active filter', async () => {
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

    const { result } = renderHook(() => useSubscriptions({ active: true }), {
      wrapper: createWrapper({ baseUrl: API_BASE }),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].status).toBe('active')
  })

  it('uses initialData without fetching', async () => {
    const initialSubscriptions = [
      subscriptionFixture({ id: 'initial-sub', status: 'active' }),
    ]

    server.use(
      http.get(`${API_BASE}/v1/customer-portal/subscriptions/`, () => {
        return HttpResponse.json({
          items: initialSubscriptions,
          pagination: { total_count: 1, page: 1, limit: 10 },
        })
      }),
    )

    const { result } = renderHook(
      () => useSubscriptions({ initialData: initialSubscriptions }),
      { wrapper: createWrapper({ baseUrl: API_BASE }) },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].id).toBe('initial-sub')
  })

  it('handles errors', async () => {
    server.use(
      http.get(`${API_BASE}/v1/customer-portal/subscriptions/`, () => {
        return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      }),
    )

    const { result } = renderHook(() => useSubscriptions(), {
      wrapper: createWrapper({ baseUrl: API_BASE }),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
  })
})
