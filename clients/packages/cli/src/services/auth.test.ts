import { beforeEach, describe, expect, test } from 'vitest'
import { Effect, Redacted } from 'effect'
import { AuthError } from '@/schemas/Auth'
import { make } from '@/services/auth'
import { Credentials } from '@/services/credentials'
import { CLIConfig } from '@/services/config'
import { OAuth } from '@/services/oauth'
import {
  fakeConfig,
  fakeCredentials,
  fakeOAuth,
  session,
} from '@/utils/test-utils/services'

const organization = { id: 'org-1', name: 'First', slug: 'first' }
const saved = session()
let credentials: ReturnType<typeof fakeCredentials>
let oauth: ReturnType<typeof fakeOAuth>
let config: ReturnType<typeof fakeConfig>
let override: string | undefined

const authEffect = () =>
  make(Effect.sync(() => override)).pipe(
    Effect.provideService(Credentials, credentials.credentials),
    Effect.provideService(OAuth, oauth.oauth),
    Effect.provideService(CLIConfig, config.config),
  )
const activity = () =>
  credentials.state.reads +
  credentials.state.writes +
  oauth.state.refreshes +
  oauth.state.logins

beforeEach(() => {
  credentials = fakeCredentials({
    sandbox: saved,
    production: session('production'),
  })
  oauth = fakeOAuth()
  config = fakeConfig({
    sandbox: organization.id,
    production: organization.id,
  })
  override = undefined
})

describe('saved sessions', () => {
  test('usable login is a no-op; replacement clears the previous organization', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(false)
    expect(oauth.state.logins).toBe(0)
    expect(credentials.state.writes).toBe(0)
    expect(await Effect.runPromise(auth.login('sandbox', true))).toBe(true)
    expect(config.state.activeOrganizations.sandbox).toBeUndefined()
    expect(
      Redacted.value(credentials.state.sessions.sandbox!.accessToken),
    ).toBe('new-account')
    expect(config.state.activeOrganizations.production).toBe(organization.id)
  })

  test('initial login persists credentials without requiring organizations', async () => {
    delete credentials.state.sessions.sandbox
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(true)
    expect(config.state.activeOrganizations.sandbox).toBeUndefined()
    expect(credentials.state.sessions.sandbox).toBeDefined()
    expect(oauth.state.logins).toBe(1)
  })

  test('failed replacement preserves the previous account and selection', async () => {
    oauth.state.failure = new AuthError({ message: 'denied' })
    const auth = await Effect.runPromise(authEffect())
    await expect(
      Effect.runPromise(auth.login('sandbox', true)),
    ).rejects.toThrow('denied')
    expect(credentials.state.sessions.sandbox).toBe(saved)
    expect(config.state.activeOrganizations.sandbox).toBe(organization.id)
    expect(credentials.state.writes).toBe(0)
  })

  test('idempotent logout clears selection only in its environment', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.logout('sandbox'))).toBe(true)
    expect(await Effect.runPromise(auth.logout('sandbox'))).toBe(false)
    expect(config.state.activeOrganizations.sandbox).toBeUndefined()
    expect(config.state.activeOrganizations.production).toBe(organization.id)
    expect(credentials.state.sessions.production).toBeDefined()
  })

  test('missing sessions provide environment-specific login guidance, never a browser', async () => {
    delete credentials.state.sessions.production
    const auth = await Effect.runPromise(authEffect())
    await expect(Effect.runPromise(auth.resolve('production'))).rejects.toThrow(
      'polar auth login --production',
    )
    expect(oauth.state.logins).toBe(0)
  })

  test('backend errors are not treated as missing sessions', async () => {
    credentials.state.failure = new AuthError({ message: 'keyring locked' })
    const auth = await Effect.runPromise(authEffect())
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'keyring locked',
    )
    expect(oauth.state.logins).toBe(0)
  })

  test('login refreshes an expiring session without launching OAuth', async () => {
    credentials.state.sessions.sandbox = session('access', {
      expiresAt: Date.now() + 10_000,
    })
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(false)
    expect(oauth.state.refreshes).toBe(1)
    expect(oauth.state.logins).toBe(0)
  })

  test('sessions without a refresh token fail instead of opening a browser', async () => {
    const { refreshToken: _, ...expired } = session('access', { expiresAt: 0 })
    credentials.state.sessions.sandbox = expired
    const auth = await Effect.runPromise(authEffect())
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'cannot be refreshed',
    )
    expect(oauth.state.logins).toBe(0)
    expect(credentials.state.writes).toBe(0)
  })

  test('rejected-token refresh coalesces and does not refresh an already rotated token', async () => {
    const auth = await Effect.runPromise(authEffect())
    await Effect.runPromise(
      Effect.all(
        [
          auth.resolve('sandbox', saved.accessToken),
          auth.resolve('sandbox', saved.accessToken),
        ],
        { concurrency: 'unbounded' },
      ),
    )
    expect(oauth.state.refreshes).toBe(1)
  })

  test('refresh failures preserve saved credentials and never open a browser', async () => {
    credentials.state.sessions.sandbox = session('access', { expiresAt: 0 })
    oauth.state.failure = new AuthError({ message: 'refresh rejected' })
    const auth = await Effect.runPromise(authEffect())
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'refresh rejected',
    )
    expect(credentials.state.writes).toBe(0)
    expect(oauth.state.logins).toBe(0)
    expect(
      Redacted.value(credentials.state.sessions.sandbox!.accessToken),
    ).toBe('access')
  })
})

describe('token override', () => {
  test('bypasses an unavailable store for either environment and redacts secrets', async () => {
    override = 'ci-secret'
    credentials.state.failure = new AuthError({ message: 'unavailable' })
    const auth = await Effect.runPromise(authEffect())
    for (const env of ['sandbox', 'production'] as const) {
      const credential = await Effect.runPromise(auth.resolve(env))
      expect(credential.source).toBe('override')
      expect(credential.session).toBeUndefined()
      expect(Redacted.value(credential.accessToken)).toBe(override)
      expect(JSON.stringify(credential)).not.toContain(override)
    }
    expect(activity()).toBe(0)
  })

  test('rejects empty overrides and never falls back after rejection', async () => {
    const auth = await Effect.runPromise(authEffect())
    override = ''
    await expect(Effect.runPromise(auth.resolve('sandbox'))).rejects.toThrow(
      'empty',
    )
    override = 'rejected'
    await expect(
      Effect.runPromise(auth.resolve('sandbox', Redacted.make(override))),
    ).rejects.toThrow('was rejected')
    expect(activity()).toBe(0)
  })

  test('blocks login but permits saved logout without unsetting the override', async () => {
    override = 'ci-secret'
    const auth = await Effect.runPromise(authEffect())
    await expect(
      Effect.runPromise(auth.login('sandbox', true)),
    ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
    await Effect.runPromise(auth.logout('sandbox'))
    expect(credentials.state.sessions.sandbox).toBeUndefined()
    expect(credentials.state.sessions.production).toBeDefined()
    expect(override).toBe('ci-secret')
    expect(activity()).toBe(0)
  })
})
