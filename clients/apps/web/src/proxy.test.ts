import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config, proxy } from './proxy'

const nextConfig = {}

describe('proxy matcher configuration', () => {
  it('should run for dashboard routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/dashboard',
      }),
    ).toBe(true)
  })

  it('should run for start routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/start',
      }),
    ).toBe(true)
  })

  it('should run for finance routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/finance',
      }),
    ).toBe(true)
  })

  it('should run for settings routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/settings',
      }),
    ).toBe(true)
  })

  it('should NOT run for API routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/api/test',
      }),
    ).toBe(false)
  })

  it('should NOT run for PostHog ingest', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/ingest/test',
      }),
    ).toBe(false)
  })

  it('should NOT run for Mintlify docs', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/docs/overview',
      }),
    ).toBe(false)
  })

  it('should NOT run for nested docs paths', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/docs/integrate/mcp',
      }),
    ).toBe(false)
  })

  it('should NOT run for _mintlify routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/_mintlify/test',
      }),
    ).toBe(false)
  })

  it('should NOT run for mintlify-assets', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/mintlify-assets/test',
      }),
    ).toBe(false)
  })

  it('should NOT run for Next.js static files', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/_next/static/chunks/test.js',
      }),
    ).toBe(false)
  })

  it('should NOT run for Next.js image optimization', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/_next/image',
      }),
    ).toBe(false)
  })

  it('should NOT run for favicon', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/favicon.ico',
      }),
    ).toBe(false)
  })

  it('should NOT run for sitemap', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/sitemap.xml',
      }),
    ).toBe(false)
  })

  it('should NOT run for robots.txt', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/robots.txt',
      }),
    ).toBe(false)
  })

  it('should run for organization routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/my-org',
      }),
    ).toBe(true)
  })

  it('should run for nested organization routes', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: '/my-org/products',
      }),
    ).toBe(true)
  })
})

describe('middleware function', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    // Set API URL env var for tests
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.NEXT_PUBLIC_API_URL
  })

  it('should redirect unauthenticated users from protected routes', async () => {
    const request = new NextRequest('https://example.com/dashboard')

    const response = await proxy(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
    expect(response.headers.get('location')).toContain('return_to=%2Fdashboard')
  })

  it('should allow authenticated users to access protected routes', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUser),
    })

    const request = new NextRequest('https://example.com/dashboard')
    request.cookies.set('spaire_session', 'valid-session-token')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-polar-user')).toBe(JSON.stringify(mockUser))
  })

  it('should allow unauthenticated access to public routes', async () => {
    const request = new NextRequest('https://example.com/')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-polar-user')).toBeNull()
  })

  it('should redirect to login with query params preserved', async () => {
    const request = new NextRequest(
      'https://example.com/dashboard?foo=bar&baz=qux',
    )

    const response = await proxy(request)

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toContain('/login')
    expect(location).toContain('return_to=%2Fdashboard%3Ffoo%3Dbar%26baz%3Dqux')
  })

  it('should redirect on unexpected API response status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })

    const request = new NextRequest('https://example.com/dashboard')
    request.cookies.set('spaire_session', 'valid-session-token')

    const response = await proxy(request)

    // Non-ok responses are logged but gracefully degrade to unauthenticated
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('should handle 401 responses gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    })

    const request = new NextRequest('https://example.com/dashboard')
    request.cookies.set('spaire_session', 'invalid-session-token')

    const response = await proxy(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
