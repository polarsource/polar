import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { customerFixture } from '../test-utils/fixtures'
import { createWrapper } from '../test-utils/render'
import { server } from '../test-utils/server'
import { useCustomer } from './useCustomer'

const API_BASE = 'http://example.com:8000'

describe('useCustomer', () => {
  it('fetches customer data', async () => {
    const mockCustomer = customerFixture({ email: 'test@example.com' })

    server.use(
      http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json(mockCustomer)
      }),
    )

    const { result } = renderHook(() => useCustomer(), {
      wrapper: createWrapper({ token: 'test_token', baseUrl: API_BASE }),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data?.email).toBe('test@example.com')
  })

  it('uses initialData without fetching', async () => {
    const initialCustomer = customerFixture({ email: 'initial@example.com' })

    const { result } = renderHook(
      () => useCustomer({ initialData: initialCustomer }),
      { wrapper: createWrapper({ baseUrl: API_BASE }) },
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data?.email).toBe('initial@example.com')
  })

  it('update mutation updates the cache', async () => {
    const originalCustomer = customerFixture({ billing_name: null })
    const updatedCustomer = customerFixture({ billing_name: 'New Name' })

    server.use(
      http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json(originalCustomer)
      }),
      http.patch(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json(updatedCustomer)
      }),
    )

    const { result } = renderHook(() => useCustomer(), {
      wrapper: createWrapper({ baseUrl: API_BASE }),
    })

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })

    expect(result.current.data?.billing_name).toBeNull()

    await result.current.update.mutateAsync({ billing_name: 'New Name' })

    await waitFor(() => {
      expect(result.current.data?.billing_name).toBe('New Name')
    })
  })

  it('handles errors', async () => {
    server.use(
      http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      }),
    )

    const { result } = renderHook(() => useCustomer(), {
      wrapper: createWrapper({ baseUrl: API_BASE }),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
  })
})
