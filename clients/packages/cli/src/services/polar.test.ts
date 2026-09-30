import { afterEach, expect, test, vi } from 'vitest'
import { Effect, Redacted } from 'effect'
import type { Polar as PolarSDK } from '@polar-sh/sdk/2026-10'
import { AuthError, type PolarEnvironment } from '@/schemas/Auth'
import { UsedEnvironments } from '@/services/api'
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('notes the environment even when there is no saved session', async () => {
  const used = new Set<PolarEnvironment>()
  const polar = await polarWith(() =>
    Effect.fail(new AuthError({ message: 'Not logged in to production.' })),
  )
  await Effect.runPromise(
    polar
      .use(() => Promise.resolve('unreachable'), 'production')
      .pipe(Effect.provideService(UsedEnvironments, used), Effect.flip),
  )
  expect([...used]).toEqual(['production'])
})

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
    status: 404,
    attempts: 1,
    message: 'Not found in sandbox. Check the ID',
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

    await expect(Effect.runPromise(polar.use(request))).rejects.toMatchObject({
      message: expect.stringContaining(message),
      statusCode: status,
    })
    expect(request).toHaveBeenCalledTimes(attempts)
    expect(resolve).toHaveBeenCalledTimes(attempts)
  },
)

test('passes the one-second request timeout to the SDK', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ id: 'customer-1' })),
  )
  const polar = await polarWith(() => Effect.succeed(overrideCredential()))
  await Effect.runPromise(
    polar.use((client) => client.customers.get('customer-1'), 'sandbox', {
      timeout: 1,
    }),
  )
  expect(timeout).toHaveBeenCalledWith(1000)
})

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

test.each([
  { organizationId: 'org-1', header: 'org-1' },
  { organizationId: undefined, header: null },
])(
  'sends Polar-Organization only for a scoped request ($organizationId)',
  async ({ organizationId, header }) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(Response.json({ id: 'org-1' }))
    vi.stubGlobal('fetch', fetch)
    const polar = await polarWith(() => Effect.succeed(overrideCredential()))
    await Effect.runPromise(
      polar.use((client) => client.organizations.get('org-1'), 'sandbox', {
        organizationId,
      }),
    )
    expect(
      new Headers(fetch.mock.calls[0]![1]?.headers).get('Polar-Organization'),
    ).toBe(header)
  },
)

test.each([
  {
    name: 'a parsed error body',
    rejection: {
      statusCode: 409,
      error: { error: 'ProductNotDeletable', detail: 'Archive it instead.' },
    },
    message: 'Archive it instead.',
  },
  {
    name: 'a raw error body',
    rejection: {
      statusCode: 409,
      error: '{"error":"ProductNotDeletable","detail":"Archive it instead."}',
    },
    message: 'Archive it instead.',
  },
  {
    name: 'validation errors',
    rejection: {
      statusCode: 422,
      error: {
        detail: [
          { loc: ['body', 'prices'], msg: 'Field required', type: 'missing' },
          {
            loc: ['body', 'config', 'body'],
            msg: 'Too long',
            type: 'too_long',
          },
          {
            loc: ['body', 'prices', 0, 'price_amount'],
            msg: 'Input should be a valid integer',
            type: 'int_type',
          },
        ],
      },
    },
    message:
      'The request is invalid:\n    prices: Field required\n    config.body: Too long\n    prices.0.price_amount: Input should be a valid integer',
  },
  {
    name: 'a body without detail',
    rejection: { statusCode: 422, error: 'Unprocessable Entity' },
    message: 'The Polar API rejected the request (422).',
  },
  {
    name: 'a server error',
    rejection: { statusCode: 503 },
    message:
      'The Polar API returned an error (503). It may be having issues, try again shortly.',
  },
  {
    name: 'a network failure',
    rejection: new TypeError('fetch failed'),
    message: 'Polar API request failed. Check your connection and try again.',
  },
])('surfaces the API message for $name', async ({ rejection, message }) => {
  const polar = await polarWith(() => Effect.succeed(overrideCredential()))
  const request = vi
    .fn<(client: PolarSDK) => Promise<string>>()
    .mockRejectedValue(rejection)

  await expect(Effect.runPromise(polar.use(request))).rejects.toMatchObject({
    message,
  })
})

const notAccessible = {
  error: 'RequestedOrganizationNotAccessible',
  detail: 'The requested organization is not accessible.',
}

test('explains an inaccessible organization in a parsed error body', async () => {
  const polar = await polarWith(() => Effect.succeed(overrideCredential()))
  const request = vi
    .fn<(client: PolarSDK) => Promise<string>>()
    .mockRejectedValue({ statusCode: 403, error: notAccessible })

  await expect(
    Effect.runPromise(
      polar.use(request, 'sandbox', { organizationId: 'org-2' }),
    ),
  ).rejects.toMatchObject({
    message:
      'Organization org-2 is not accessible with this credential. Check --org or run polar auth org.',
    statusCode: 403,
  })
})

test('explains an inaccessible organization in a raw API response', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json(notAccessible, { status: 403 })),
  )
  const polar = await polarWith(() => Effect.succeed(overrideCredential()))
  await expect(
    Effect.runPromise(
      polar.use((client) => client.products.list(), 'sandbox', {
        organizationId: 'org-2',
      }),
    ),
  ).rejects.toThrow('Organization org-2 is not accessible')
})
