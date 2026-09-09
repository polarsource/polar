import { beforeEach, describe, expect, test } from 'bun:test'
import { Effect, Redacted } from 'effect'
import { AuthError, type PolarEnvironment, type Session } from '../schemas/Auth'
import { make } from './auth'
import { Credentials } from './credentials'
import { OAuth } from './oauth'

const organization = { id: 'org-1', name: 'First', slug: 'first' }
const session: Session = {
  version: 1,
  accessToken: Redacted.make('access'),
  refreshToken: Redacted.make('refresh'),
  expiresAt: Date.now() + 3600_000,
  scopes: ['organizations:read'],
  organization,
}
let sessions: Partial<Record<PolarEnvironment, Session>>
let override: string | undefined
let reads: number
let writes: number
let refreshes: number
let logins: number
let failure: AuthError | undefined
let storeFailure: AuthError | undefined

const store = Credentials.of({
  read: (env) =>
    Effect.suspend(() => {
      reads++
      return storeFailure
        ? Effect.fail(storeFailure)
        : Effect.succeed(sessions[env])
    }),
  write: (env, session) =>
    Effect.sync(() => {
      writes++
      sessions[env] = session
    }),
  delete: (env) =>
    Effect.sync(() => {
      const present = !!sessions[env]
      delete sessions[env]
      return present
    }),
})
const oauth = OAuth.of({
  login: () =>
    Effect.suspend(() => {
      logins++
      return failure
        ? Effect.fail(failure)
        : Effect.succeed({
            ...session,
            accessToken: Redacted.make('new-account'),
          })
    }),
  refresh: (_env, previous) =>
    Effect.suspend(() => {
      refreshes++
      return failure
        ? Effect.fail(failure)
        : Effect.succeed({
            ...previous,
            expiresAt: Date.now() + 3600_000,
            accessToken: Redacted.make('rotated'),
            refreshToken: Redacted.make('rotated-refresh'),
          })
    }),
})
const authEffect = make(Effect.sync(() => override)).pipe(
  Effect.provideService(Credentials, store),
  Effect.provideService(OAuth, oauth),
)

beforeEach(() => {
  sessions = {
    sandbox: session,
    production: { ...session, accessToken: Redacted.make('production') },
  }
  override = undefined
  reads = writes = refreshes = logins = 0
  failure = storeFailure = undefined
})

describe('saved sessions', () => {
  test('usable login is a no-op; replacement clears the previous organization', async () => {
    const auth = await Effect.runPromise(authEffect)
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(false)
    expect(logins).toBe(0)
    expect(writes).toBe(0)
    expect(await Effect.runPromise(auth.login('sandbox', true))).toBe(true)
    expect(sessions.sandbox?.organization).toBeUndefined()
    expect(Redacted.value(sessions.sandbox!.accessToken)).toBe('new-account')
    expect(sessions.production?.organization).toEqual(organization)
  })

  test('initial login persists credentials without requiring organizations', async () => {
    delete sessions.sandbox
    const auth = await Effect.runPromise(authEffect)
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(true)
    expect(
      (await Effect.runPromise(auth.resolve('sandbox'))).session?.organization,
    ).toBeUndefined()
    expect(logins).toBe(1)
  })

  test('failed replacement preserves the previous account and selection', async () => {
    failure = new AuthError({ message: 'denied' })
    const auth = await Effect.runPromise(authEffect)
    await expect(
      Effect.runPromise(auth.login('sandbox', true)),
    ).rejects.toThrow('denied')
    expect(sessions.sandbox).toBe(session)
    expect(writes).toBe(0)
  })

  test('selection and idempotent logout are environment isolated', async () => {
    const auth = await Effect.runPromise(authEffect)
    await Effect.runPromise(
      auth.select('sandbox', { id: 'org-2', name: 'Second', slug: 'second' }),
    )
    expect(sessions.sandbox?.organization?.id).toBe('org-2')
    expect(sessions.production?.organization).toEqual(organization)
    expect(await Effect.runPromise(auth.logout('sandbox'))).toBe(true)
    expect(await Effect.runPromise(auth.logout('sandbox'))).toBe(false)
    expect(sessions.production).toBeDefined()
  })

  test('missing sessions provide environment-specific login guidance, never a browser', async () => {
    delete sessions.production
    const auth = await Effect.runPromise(authEffect)
    await expect(Effect.runPromise(auth.resolve('production'))).rejects.toThrow(
      'polar auth login --production',
    )
    expect(logins).toBe(0)
  })

  test('backend errors are not treated as missing sessions', async () => {
    storeFailure = new AuthError({ message: 'keyring locked' })
    const auth = await Effect.runPromise(authEffect)
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'keyring locked',
    )
    expect(logins).toBe(0)
  })

  test('concurrent expired resolutions rotate once and preserve organization', async () => {
    sessions.sandbox = { ...session, expiresAt: 0 }
    const auth = await Effect.runPromise(authEffect)
    const credentials = await Effect.runPromise(
      Effect.all(
        Array.from({ length: 8 }, () => auth.resolve('sandbox')),
        { concurrency: 'unbounded' },
      ),
    )
    expect(refreshes).toBe(1)
    expect(writes).toBe(1)
    expect(
      credentials.every(
        (credential) => Redacted.value(credential.accessToken) === 'rotated',
      ),
    ).toBe(true)
    expect(Redacted.value(sessions.sandbox!.refreshToken!)).toBe(
      'rotated-refresh',
    )
    expect(sessions.sandbox?.organization).toEqual(organization)
  })

  test('login refreshes an expiring session without launching OAuth', async () => {
    sessions.sandbox = { ...session, expiresAt: Date.now() + 10_000 }
    const auth = await Effect.runPromise(authEffect)
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(false)
    expect(refreshes).toBe(1)
    expect(logins).toBe(0)
  })

  test('rejected-token refresh coalesces and does not refresh an already rotated token', async () => {
    const auth = await Effect.runPromise(authEffect)
    await Effect.runPromise(
      Effect.all(
        [
          auth.resolve('sandbox', session.accessToken),
          auth.resolve('sandbox', session.accessToken),
        ],
        { concurrency: 'unbounded' },
      ),
    )
    expect(refreshes).toBe(1)
  })

  test('refresh failures preserve saved credentials and never open a browser', async () => {
    sessions.sandbox = { ...session, expiresAt: 0 }
    failure = new AuthError({ message: 'refresh rejected' })
    const auth = await Effect.runPromise(authEffect)
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'refresh rejected',
    )
    expect(writes).toBe(0)
    expect(logins).toBe(0)
    expect(Redacted.value(sessions.sandbox.accessToken)).toBe('access')
  })
})

describe('token override', () => {
  test('bypasses an unavailable store for either environment and redacts secrets', async () => {
    override = 'ci-secret'
    storeFailure = new AuthError({ message: 'unavailable' })
    const auth = await Effect.runPromise(authEffect)
    for (const env of ['sandbox', 'production'] as const) {
      const credential = await Effect.runPromise(auth.resolve(env))
      expect(credential.source).toBe('override')
      expect(credential.session).toBeUndefined()
      expect(Redacted.value(credential.accessToken)).toBe(override)
      expect(JSON.stringify(credential)).not.toContain(override)
    }
    expect(reads + writes + refreshes + logins).toBe(0)
  })

  test('rejects empty overrides and never falls back after rejection', async () => {
    const auth = await Effect.runPromise(authEffect)
    override = ''
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'empty',
    )
    override = 'rejected'
    await expect(
      Effect.runPromise(auth.resolve('sandbox', Redacted.make(override))),
    ).rejects.toThrow('was rejected')
    expect(reads + writes + refreshes + logins).toBe(0)
  })

  test('blocks login and selection but permits saved logout without unsetting the override', async () => {
    override = 'ci-secret'
    const auth = await Effect.runPromise(authEffect)
    await expect(
      Effect.runPromise(auth.login('sandbox', true)),
    ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
    await expect(
      Effect.runPromise(auth.select('sandbox', organization)),
    ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
    await Effect.runPromise(auth.logout('sandbox'))
    expect(sessions.sandbox).toBeUndefined()
    expect(sessions.production).toBeDefined()
    expect(override).toBe('ci-secret')
    expect(reads + writes + refreshes + logins).toBe(0)
  })
})
