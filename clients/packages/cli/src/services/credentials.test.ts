import { beforeEach, describe, expect, vi, test } from 'vitest'
import { Effect, Redacted } from 'effect'
import type { Session } from '@/schemas/Auth'
import { Credentials, layer } from '@/services/credentials'

const keyring = vi.hoisted(() => ({
  passwords: new Map<string, string>(),
  constructorError: undefined as Error | undefined,
  accessError: undefined as Error | undefined,
}))

vi.mock('@napi-rs/keyring', () => ({
  AsyncEntry: class {
    private readonly key: string
    constructor(service: string, account: string) {
      if (keyring.constructorError) throw keyring.constructorError
      this.key = `${service}:${account}`
    }
    async getPassword() {
      if (keyring.accessError) throw keyring.accessError
      return keyring.passwords.get(this.key) ?? null
    }
    async setPassword(value: string) {
      if (keyring.accessError) throw keyring.accessError
      keyring.passwords.set(this.key, value)
    }
    async deleteCredential() {
      if (keyring.accessError) throw keyring.accessError
      return keyring.passwords.delete(this.key)
    }
  },
}))

const session: Session = {
  version: 1,
  accessToken: Redacted.make('access'),
  refreshToken: Redacted.make('refresh'),
  expiresAt: 1_700_000_000_000,
  scopes: ['organizations:read'],
}

const run = <A, E>(
  use: (credentials: (typeof Credentials)['Service']) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const credentials = yield* Credentials
      return yield* use(credentials)
    }).pipe(Effect.provide(layer)),
  )

beforeEach(() => {
  keyring.passwords.clear()
  keyring.constructorError = undefined
  keyring.accessError = undefined
})

describe('Credentials', () => {
  test('round-trips sessions per environment through the keyring', async () => {
    await run((credentials) => credentials.write('sandbox', session))

    const stored = await run((credentials) => credentials.read('sandbox'))
    expect(stored?.version).toBe(1)
    expect(Redacted.value(stored!.accessToken)).toBe('access')
    expect(Redacted.value(stored!.refreshToken!)).toBe('refresh')
    expect(stored?.scopes).toEqual(['organizations:read'])
    expect(keyring.passwords.get('polar-cli:sandbox')).not.toContain('Redacted')
    await expect(
      run((credentials) => credentials.read('production')),
    ).resolves.toBeUndefined()
  })

  test('reports whether a session was deleted', async () => {
    await run((credentials) => credentials.write('sandbox', session))

    await expect(
      run((credentials) => credentials.delete('sandbox')),
    ).resolves.toBe(true)
    await expect(
      run((credentials) => credentials.delete('sandbox')),
    ).resolves.toBe(false)
  })

  test('rejects corrupt saved sessions', async () => {
    keyring.passwords.set('polar-cli:sandbox', '{"version":2}')

    await expect(
      run((credentials) => credentials.read('sandbox')),
    ).rejects.toThrow('Saved session is corrupt or unsupported')
  })

  test('fails when the native keyring cannot be loaded', async () => {
    keyring.constructorError = new Error('missing native module')

    await expect(
      run((credentials) => credentials.read('sandbox')),
    ).rejects.toThrow('OS keyring unavailable')
  })

  test('fails when the keyring denies access', async () => {
    keyring.accessError = new Error('locked')

    await expect(
      run((credentials) => credentials.read('sandbox')),
    ).rejects.toThrow('OS keyring unavailable')
    await expect(
      run((credentials) => credentials.write('sandbox', session)),
    ).rejects.toThrow('OS keyring unavailable')
    await expect(
      run((credentials) => credentials.delete('sandbox')),
    ).rejects.toThrow('OS keyring unavailable')
  })
})
