import { expect, test } from 'vitest'
import type { ErrorEvent } from '@sentry/cloudflare'
import { scrub, sentryOptions } from '../src/sentry'

test('scrub keeps the route but drops headers, query strings, users and identifiers', () => {
  const event = {
    type: undefined,
    request: {
      method: 'POST',
      url: 'https://mcp.polar.sh/mcp/polar-mcp?telemetry=false',
      headers: { Authorization: 'Bearer polar_oat_secret' },
      data: '{"code":"secret code"}',
      query_string: 'telemetry=false',
    },
    user: { ip_address: '203.0.113.42' },
    message: 'failed for jane@example.com',
    exception: {
      values: [
        {
          type: 'Error',
          value:
            'GET https://api.polar.sh/v1/customers/2f1c0e3a-8f7a-4bd1-9c2e-1a2b3c4d5e6f timed out',
        },
      ],
    },
  } as unknown as ErrorEvent
  const scrubbed = scrub(event)
  expect(scrubbed.request).toEqual({
    method: 'POST',
    url: 'https://mcp.polar.sh/mcp/polar-mcp',
  })
  expect(scrubbed.user).toBeUndefined()
  expect(scrubbed.message).toBe('failed for <redacted>')
  expect(scrubbed.exception?.values?.[0]?.value).toBe(
    'GET <redacted> timed out',
  )
  expect(JSON.stringify(scrubbed)).not.toContain('secret')
})

test('an empty DSN disables Sentry; environment and release come from the bindings', () => {
  const options = sentryOptions({
    SENTRY_DSN: '',
    SENTRY_ENVIRONMENT: 'production',
    SENTRY_RELEASE: 'polar-mcp@abc123',
  })
  expect(options.dsn).toBeUndefined()
  expect(options.environment).toBe('production')
  expect(options.release).toBe('polar-mcp@abc123')
  expect(options.tracesSampleRate).toBe(0)
  expect(options.dataCollection).toEqual({ userInfo: false, httpBodies: [] })
  expect(
    sentryOptions({
      SENTRY_DSN: '',
      SENTRY_ENVIRONMENT: 'development',
      SENTRY_RELEASE: '',
    }).release,
  ).toMatch(/^polar-mcp@\d/)
})
