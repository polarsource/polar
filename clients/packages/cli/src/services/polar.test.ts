import { afterEach, expect, test, vi } from 'vitest'
import { Effect, Redacted } from 'effect'
import type { Polar as PolarSDK } from '@polar-sh/sdk/2026-04'
import { AuthError, type PolarEnvironment } from '../schemas/Auth'
import { Auth, type Credential } from './auth'
import { make } from './polar'

afterEach(() => vi.unstubAllGlobals())

test('retries a rejected saved token with refreshed credentials in the same environment', async () => {
  const accessToken = Redacted.make('saved-token')
  const resolve = vi
    .fn<
      (
        environment: PolarEnvironment,
        rejected?: Redacted.Redacted<string>,
      ) => Effect.Effect<Credential, AuthError>
    >()
    .mockReturnValueOnce(Effect.succeed({ source: 'keyring', accessToken }))
    .mockReturnValueOnce(
      Effect.succeed({
        source: 'keyring',
        accessToken: Redacted.make('refreshed-token'),
      }),
    )
  const auth = Auth.of({
    resolve,
    override: Effect.succeed(false),
    login: () => Effect.die('unused'),
    logout: () => Effect.die('unused'),
  })
  const polar = await Effect.runPromise(
    make.pipe(Effect.provideService(Auth, auth)),
  )
  const organization = { id: 'org-1', name: 'First', slug: 'first' }
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(
      Response.json({ detail: 'Unauthorized' }, { status: 401 }),
    )
    .mockResolvedValueOnce(Response.json(organization))
  vi.stubGlobal('fetch', fetch)

  expect(
    await Effect.runPromise(
      polar.use((client) => client.organizations.get('org-1'), 'production'),
    ),
  ).toEqual(organization)
  expect(resolve.mock.calls).toEqual([
    ['production'],
    ['production', accessToken],
  ])
  expect(
    fetch.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Authorization'),
    ),
  ).toEqual(['Bearer saved-token', 'Bearer refreshed-token'])
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://api.polar.sh/v1/organizations/org-1',
    'https://api.polar.sh/v1/organizations/org-1',
  ])
})

test.each([
  {
    source: 'override' as const,
    status: 401,
    attempts: 1,
    message: 'Authentication rejected',
  },
  {
    source: 'keyring' as const,
    status: 403,
    attempts: 1,
    message: 'Access denied',
  },
  {
    source: 'keyring' as const,
    status: 401,
    attempts: 2,
    message: 'Authentication rejected',
  },
])(
  'bounds retries for $source credentials on HTTP $status',
  async ({ source, status, attempts, message }) => {
    const resolve = vi.fn(
      (_environment: PolarEnvironment, _rejected?: Redacted.Redacted<string>) =>
        Effect.succeed({ source, accessToken: Redacted.make('token') }),
    )
    const auth = Auth.of({
      resolve,
      override: Effect.succeed(source === 'override'),
      login: () => Effect.die('unused'),
      logout: () => Effect.die('unused'),
    })
    const polar = await Effect.runPromise(
      make.pipe(Effect.provideService(Auth, auth)),
    )
    const request = vi
      .fn<(client: PolarSDK) => Promise<string>>()
      .mockRejectedValue({ statusCode: status })

    await expect(Effect.runPromise(polar.use(request))).rejects.toThrow(message)
    expect(request).toHaveBeenCalledTimes(attempts)
    expect(resolve).toHaveBeenCalledTimes(attempts)
  },
)

test('preserves refresh failures without retrying the API request', async () => {
  const error = new AuthError({ message: 'Unable to refresh saved session.' })
  const resolve = vi.fn(
    (
      _environment: PolarEnvironment,
      rejected?: Redacted.Redacted<string>,
    ): Effect.Effect<Credential, AuthError> =>
      rejected
        ? Effect.fail(error)
        : Effect.succeed({
            source: 'keyring',
            accessToken: Redacted.make('token'),
          }),
  )
  const auth = Auth.of({
    resolve,
    override: Effect.succeed(false),
    login: () => Effect.die('unused'),
    logout: () => Effect.die('unused'),
  })
  const polar = await Effect.runPromise(
    make.pipe(Effect.provideService(Auth, auth)),
  )
  const request = vi
    .fn<(client: PolarSDK) => Promise<string>>()
    .mockRejectedValue({ statusCode: 401 })

  expect(await Effect.runPromise(polar.use(request).pipe(Effect.flip))).toBe(
    error,
  )
  expect(request).toHaveBeenCalledTimes(1)
})
