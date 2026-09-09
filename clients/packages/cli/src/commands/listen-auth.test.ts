import { beforeEach, expect, test } from 'vitest'
import { Effect, Redacted } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { AuthError, type PolarEnvironment } from '../schemas/Auth'
import { Auth } from '../services/auth'
import { authenticatedStreamClient } from './listen'

let token: string
let source: 'keyring' | 'override'
let requests: string[]
let resolutions: PolarEnvironment[]
let refreshes: number
let failure: boolean
let status: number
const auth = Auth.of({
  override: Effect.succeed(false),
  resolve: (environment, rejected) =>
    Effect.gen(function* () {
      resolutions.push(environment)
      if (failure) return yield* new AuthError({ message: 'refresh failed' })
      if (rejected) {
        refreshes++
        token = 'rotated'
      }
      return { accessToken: Redacted.make(token), source }
    }),
  login: () => Effect.die('listen must not open the browser'),
  logout: () => Effect.die('unused'),
  select: () => Effect.die('unused'),
})
const forward: (
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
) => Promise<Response> = async (_input, init) => {
  requests.push(new Headers(init?.headers).get('Authorization') ?? '')
  return new Response(null, { status })
}

const makeClient = (environment: PolarEnvironment) =>
  authenticatedStreamClient(environment).pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, forward as typeof fetch),
  )

beforeEach(() => {
  token = 'initial'
  source = 'keyring'
  requests = []
  resolutions = []
  refreshes = 0
  failure = false
  status = 200
})

test('reconnections resolve current credentials in the same environment', async () => {
  const stream = await Effect.runPromise(
    makeClient('production').pipe(Effect.provideService(Auth, auth)),
  )
  await Effect.runPromise(Effect.scoped(stream.get('https://example.test')))
  token = 'new-token'
  await Effect.runPromise(Effect.scoped(stream.get('https://example.test')))
  expect(requests).toEqual(['Bearer initial', 'Bearer new-token'])
  expect(resolutions).toEqual(['production', 'production'])
})

test('401 refresh is bounded to one retry across the entire listener', async () => {
  status = 401
  const stream = await Effect.runPromise(
    makeClient('sandbox').pipe(Effect.provideService(Auth, auth)),
  )
  expect(
    (await Effect.runPromise(Effect.scoped(stream.get('https://example.test'))))
      .status,
  ).toBe(401)
  expect(
    (await Effect.runPromise(Effect.scoped(stream.get('https://example.test'))))
      .status,
  ).toBe(401)
  expect(requests).toEqual([
    'Bearer initial',
    'Bearer rotated',
    'Bearer rotated',
  ])
  expect(refreshes).toBe(1)
})

test('override rejection never refreshes or falls back to saved credentials', async () => {
  source = 'override'
  status = 401
  const stream = await Effect.runPromise(
    makeClient('sandbox').pipe(Effect.provideService(Auth, auth)),
  )
  expect(
    (await Effect.runPromise(Effect.scoped(stream.get('https://example.test'))))
      .status,
  ).toBe(401)
  expect(requests).toEqual(['Bearer initial'])
  expect(refreshes).toBe(0)
})

test('resolution failures reject instead of making an unauthenticated request', async () => {
  failure = true
  const stream = await Effect.runPromise(
    makeClient('sandbox').pipe(Effect.provideService(Auth, auth)),
  )
  await expect(
    Effect.runPromise(Effect.scoped(stream.get('https://example.test'))),
  ).rejects.toThrow('refresh failed')
  expect(requests).toEqual([])
})
