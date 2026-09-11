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

const sandboxOrg = { id: 'org-1', environment: 'sandbox' as const }
const saved = session()
let credentials: ReturnType<typeof fakeCredentials>
let oauth: ReturnType<typeof fakeOAuth>
let config: ReturnType<typeof fakeConfig>
let override: string | undefined
let environment: string | undefined

const authEffect = () =>
  make(
    Effect.sync(() => override),
    Effect.sync(() => environment),
  ).pipe(
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
  config = fakeConfig(sandboxOrg)
  override = undefined
  environment = undefined
})

describe('saved sessions', () => {
  test('usable login is a no-op; replacement clears a selection in that environment', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(false)
    expect(oauth.state.logins).toBe(0)
    expect(credentials.state.writes).toBe(0)
    expect(await Effect.runPromise(auth.login('sandbox', true))).toBe(true)
    expect(config.state.activeOrganization).toBeUndefined()
    expect(
      Redacted.value(credentials.state.sessions.sandbox!.accessToken),
    ).toBe('new-account')
  })

  test('replacing the other environment keeps the selection', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.login('production', true))).toBe(true)
    expect(config.state.activeOrganization).toEqual(sandboxOrg)
    expect(config.state.writes).toBe(0)
  })

  test('initial login persists credentials without requiring organizations', async () => {
    delete credentials.state.sessions.sandbox
    config = fakeConfig()
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.login('sandbox', false))).toBe(true)
    expect(config.state.activeOrganization).toBeUndefined()
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
    expect(config.state.activeOrganization).toEqual(sandboxOrg)
    expect(credentials.state.writes).toBe(0)
  })

  test('logout of one environment keeps the other session and an unrelated selection', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.logout(['production']))).toEqual([
      'production',
    ])
    expect(credentials.state.sessions.production).toBeUndefined()
    expect(credentials.state.sessions.sandbox).toBe(saved)
    expect(config.state.activeOrganization).toEqual(sandboxOrg)
    expect(await Effect.runPromise(auth.logout(['production']))).toEqual([])
  })

  test('logout clears the selection that belonged to that environment', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(
      await Effect.runPromise(auth.logout(['sandbox', 'production'])),
    ).toEqual(['sandbox', 'production'])
    expect(credentials.state.sessions).toEqual({})
    expect(config.state.activeOrganization).toBeUndefined()
  })

  test('reports the environments with a saved session', async () => {
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.environments)).toEqual([
      'sandbox',
      'production',
    ])
    delete credentials.state.sessions.sandbox
    expect(await Effect.runPromise(auth.environments)).toEqual(['production'])
    delete credentials.state.sessions.production
    expect(await Effect.runPromise(auth.environments)).toEqual([])
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
    await expect(Effect.runPromise(auth.environments)).rejects.toThrow(
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

  test('targets production unless POLAR_ENVIRONMENT says otherwise', async () => {
    override = 'ci-secret'
    const auth = await Effect.runPromise(authEffect())
    expect(await Effect.runPromise(auth.environments)).toEqual(['production'])
    environment = 'sandbox'
    expect(await Effect.runPromise(auth.environments)).toEqual(['sandbox'])
    environment = 'staging'
    await expect(Effect.runPromise(auth.environments)).rejects.toThrow(
      'POLAR_ENVIRONMENT must be "sandbox" or "production"',
    )
    expect(credentials.state.reads).toBe(0)
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

  test('blocks login but permits logout without unsetting the override', async () => {
    override = 'ci-secret'
    const auth = await Effect.runPromise(authEffect())
    await expect(
      Effect.runPromise(auth.login('sandbox', true)),
    ).rejects.toThrow('Unset POLAR_ACCESS_TOKEN')
    expect(
      await Effect.runPromise(auth.logout(['sandbox', 'production'])),
    ).toEqual(['sandbox', 'production'])
    expect(credentials.state.sessions).toEqual({})
    expect(override).toBe('ci-secret')
    expect(oauth.state.logins + oauth.state.refreshes).toBe(0)
  })
})
