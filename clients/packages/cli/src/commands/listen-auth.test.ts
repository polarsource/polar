import { beforeEach, expect, test } from 'bun:test'
import { Effect, Redacted } from 'effect'
import { AuthError, type PolarEnvironment } from '../schemas/Auth'
import { Auth } from '../services/auth'
import { authenticatedStreamFetch, type StreamFetch } from './listen-auth'

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
const forward: StreamFetch = async (_input, init) => {
  requests.push(new Headers(init?.headers).get('Authorization') ?? '')
  return new Response(null, { status })
}

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
    authenticatedStreamFetch('production', forward).pipe(
      Effect.provideService(Auth, auth),
    ),
  )
  await stream('https://example.test', {})
  token = 'new-token'
  await stream('https://example.test', {})
  expect(requests).toEqual(['Bearer initial', 'Bearer new-token'])
  expect(resolutions).toEqual(['production', 'production'])
})

test('401 refresh is bounded to one retry across the entire listener', async () => {
  status = 401
  const stream = await Effect.runPromise(
    authenticatedStreamFetch('sandbox', forward).pipe(
      Effect.provideService(Auth, auth),
    ),
  )
  expect((await stream('https://example.test', {})).status).toBe(401)
  expect((await stream('https://example.test', {})).status).toBe(401)
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
    authenticatedStreamFetch('sandbox', forward).pipe(
      Effect.provideService(Auth, auth),
    ),
  )
  expect((await stream('https://example.test', {})).status).toBe(401)
  expect(requests).toEqual(['Bearer initial'])
  expect(refreshes).toBe(0)
})

test('resolution failures reject instead of making an unauthenticated request', async () => {
  failure = true
  const stream = await Effect.runPromise(
    authenticatedStreamFetch('sandbox', forward).pipe(
      Effect.provideService(Auth, auth),
    ),
  )
  await expect(stream('https://example.test', {})).rejects.toThrow(
    'refresh failed',
  )
  expect(requests).toEqual([])
})
