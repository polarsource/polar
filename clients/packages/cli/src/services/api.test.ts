import { describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import {
  apiOrigin,
  apiUrl,
  describeApiFailure,
  Environment,
} from '@/services/api'

const withEnv = <A>(
  effect: Effect.Effect<A>,
  env: Record<string, string | undefined>,
) => Effect.runSync(effect.pipe(Effect.provideService(Environment, env)))

describe('apiUrl', () => {
  test('uses the environment origin by default', () => {
    expect(withEnv(apiUrl('sandbox', '/cli/events'), {})).toBe(
      'https://sandbox-api.polar.sh/v1/cli/events',
    )
    expect(withEnv(apiUrl('production', '/cli/events'), {})).toBe(
      'https://api.polar.sh/v1/cli/events',
    )
  })

  test('honors POLAR_API_URL and strips trailing slashes', () => {
    expect(
      withEnv(apiUrl('production', '/cli/events'), {
        POLAR_API_URL: 'http://127.0.0.1:8000//',
      }),
    ).toBe('http://127.0.0.1:8000/v1/cli/events')
  })

  test.each([
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://api.polar.localhost',
    'https://api.staging.example',
  ])('accepts %s', (value) => {
    expect(withEnv(apiOrigin('sandbox'), { POLAR_API_URL: value })).toBe(value)
  })

  test('rejects plain http to a non-local host', () => {
    expect(() =>
      withEnv(apiOrigin('sandbox'), { POLAR_API_URL: 'http://api.example' }),
    ).toThrow('must use https unless it points at localhost')
  })

  test.each(['not a url', 'ftp://127.0.0.1'])('rejects %s', (value) => {
    expect(() =>
      withEnv(apiOrigin('sandbox'), { POLAR_API_URL: value }),
    ).toThrow('POLAR_API_URL must be an http(s) URL')
  })

  test.each(['', '   '])('treats %j POLAR_API_URL as unset', (value) => {
    expect(withEnv(apiOrigin('sandbox'), { POLAR_API_URL: value })).toBe(
      'https://sandbox-api.polar.sh',
    )
  })
})

describe('describeApiFailure', () => {
  test.each([
    [401, 'Authentication rejected for sandbox', 'polar auth login --sandbox'],
    [403, 'You do not have access to this organization', 'webhooks:write'],
    [404, 'could not be found in sandbox', 'polar auth org'],
    [503, 'returned an error (503)', 'try again shortly'],
  ])('describes %d', (status, message, hint) => {
    const failure = describeApiFailure(status, 'sandbox')
    expect(failure.message).toContain(message)
    expect(failure.hint).toContain(hint)
  })

  test('has no hint for other statuses', () => {
    expect(describeApiFailure(418, 'sandbox')).toEqual({
      message: 'The API returned an unexpected status (418)',
    })
  })
})
