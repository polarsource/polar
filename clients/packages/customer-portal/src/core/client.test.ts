import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test-utils/server'
import { createPortalClient } from './client'
import {
  PolarCustomerPortalError,
  RateLimitError,
  UnauthorizedError,
} from './errors'

const API_BASE = 'http://example.com:8000'

describe('createPortalClient', () => {
  it('creates a client with the given config', () => {
    const client = createPortalClient({
      token: 'test_token',
      organizationId: 'org_123',
      baseUrl: API_BASE,
    })

    expect(client.config.token).toBe('test_token')
    expect(client.config.organizationId).toBe('org_123')
  })

  it('calls onUnauthorized and throws UnauthorizedError on 401', async () => {
    const onUnauthorized = vi.fn()

    server.use(
      http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      }),
    )

    const portalClient = createPortalClient({
      token: 'expired_token',
      organizationId: 'org_123',
      baseUrl: API_BASE,
      onUnauthorized,
    })

    await expect(
      portalClient.request((client) =>
        client.GET('/v1/customer-portal/customers/me'),
      ),
    ).rejects.toThrow(UnauthorizedError)

    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('throws RateLimitError on 429', async () => {
    server.use(
      http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json(
          { detail: 'Too Many Requests' },
          { status: 429 },
        )
      }),
    )

    const portalClient = createPortalClient({
      token: 'test_token',
      organizationId: 'org_123',
      baseUrl: API_BASE,
    })

    await expect(
      portalClient.request((client) =>
        client.GET('/v1/customer-portal/customers/me'),
      ),
    ).rejects.toThrow(RateLimitError)
  })

  it('throws PolarCustomerPortalError on other errors', async () => {
    server.use(
      http.get(`${API_BASE}/v1/customer-portal/customers/me`, () => {
        return HttpResponse.json(
          { detail: 'Not Found', type: 'not_found' },
          { status: 404 },
        )
      }),
    )

    const portalClient = createPortalClient({
      token: 'test_token',
      organizationId: 'org_123',
      baseUrl: API_BASE,
    })

    await expect(
      portalClient.request((client) =>
        client.GET('/v1/customer-portal/customers/me'),
      ),
    ).rejects.toThrow(PolarCustomerPortalError)
  })
})
