import { afterEach, expect, test, vi } from 'vitest'
import { Effect, Redacted } from 'effect'
import type { Polar as PolarSDK } from '@polar-sh/sdk/2026-04'
import { AuthError, type PolarEnvironment } from '@/schemas/Auth'
import { Auth, type Credential } from '@/services/auth'
import { make } from '@/services/polar'
import {
  fakeAuth,
  keyringCredential,
  overrideCredential,
} from '@/utils/test-utils/services'

type Resolve = (
  environment: PolarEnvironment,
  rejected?: Redacted.Redacted<string>,
) => Effect.Effect<Credential, AuthError>

const polarWith = (resolve: Resolve) =>
  Effect.runPromise(
    make.pipe(
      Effect.provideService(Auth, Auth.of({ ...fakeAuth().auth, resolve })),
    ),
  )

afterEach(() => vi.unstubAllGlobals())

test('retries a rejected saved token with refreshed credentials in the same environment', async () => {
  const saved = keyringCredential('saved-token')
  const resolve = vi
    .fn<Resolve>()
    .mockReturnValueOnce(Effect.succeed(saved))
    .mockReturnValueOnce(Effect.succeed(keyringCredential('refreshed-token')))
  const polar = await polarWith(resolve)
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
    ['production', saved.accessToken],
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
    credential: overrideCredential(),
    status: 401,
    attempts: 1,
    message: 'Authentication rejected',
  },
  {
    credential: keyringCredential(),
    status: 403,
    attempts: 1,
    message: 'Access denied',
  },
  {
    credential: keyringCredential(),
    status: 401,
    attempts: 2,
    message: 'Authentication rejected',
  },
])(
  'bounds retries for $credential.source credentials on HTTP $status',
  async ({ credential, status, attempts, message }) => {
    const resolve = vi.fn<Resolve>(() => Effect.succeed(credential))
    const polar = await polarWith(resolve)
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
  const polar = await polarWith((_environment, rejected) =>
    rejected ? Effect.fail(error) : Effect.succeed(keyringCredential()),
  )
  const request = vi
    .fn<(client: PolarSDK) => Promise<string>>()
    .mockRejectedValue({ statusCode: 401 })

  expect(await Effect.runPromise(polar.use(request).pipe(Effect.flip))).toBe(
    error,
  )
  expect(request).toHaveBeenCalledTimes(1)
})
