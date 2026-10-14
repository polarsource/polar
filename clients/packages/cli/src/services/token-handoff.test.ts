import { generateKeyPairSync } from 'node:crypto'
import { Redacted } from 'effect'
import { expect, test } from 'vitest'
import type { ActiveOrganization } from '@/schemas/Auth'
import { parseHandoff, tokenPage } from '@/services/token-handoff'

const acme: ActiveOrganization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  environment: 'sandbox',
}

const keys = () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  return {
    privateKey,
    spki: publicKey.export({ type: 'spki', format: 'der' }),
  }
}

const encryptLikeTheBrowser = async (spki: Buffer, token: string) => {
  const key = await crypto.subtle.importKey(
    'spki',
    new Uint8Array(spki),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(token),
  )
  return Buffer.from(encrypted).toString('base64url')
}

const callback = (params: Record<string, string>) =>
  new URL(`http://127.0.0.1:3333/token/callback?${new URLSearchParams(params)}`)

test('points at the organization token page', () => {
  const page = tokenPage(
    'https://sandbox.polar.sh',
    { organization: acme, name: 'my-app', scopes: ['products:read'] },
    'state',
    'key',
  )
  expect(page.origin).toBe('https://sandbox.polar.sh')
  expect(page.pathname).toBe('/dashboard/acme/cli/token')
  expect(Object.fromEntries(page.searchParams)).toEqual({
    state: 'state',
    public_key: 'key',
    name: 'my-app',
    scopes: 'products:read',
  })
})

test('omits scopes when none are requested', () => {
  const page = tokenPage(
    'https://polar.sh',
    {
      organization: acme,
      name: 'x',
      scopes: [],
    },
    'state',
    'key',
  )
  expect(page.searchParams.has('scopes')).toBe(false)
})

test('decrypts a token encrypted by the browser', async () => {
  const { privateKey, spki } = keys()
  const encrypted = await encryptLikeTheBrowser(spki, 'polar_oat_secret')
  const result = parseHandoff(
    callback({ encrypted_token: encrypted }),
    privateKey,
  )
  expect(result.outcome).toBe('success')
  if (result.outcome === 'success')
    expect(Redacted.value(result.value)).toBe('polar_oat_secret')
})

test('rejects a token encrypted for another key', async () => {
  const { spki } = keys()
  const encrypted = await encryptLikeTheBrowser(spki, 'polar_oat_secret')
  const result = parseHandoff(
    callback({ encrypted_token: encrypted }),
    keys().privateKey,
  )
  expect(result.outcome).toBe('invalid')
})

test.each([
  [{ error: 'access_denied' }, 'denied'],
  [{}, 'invalid'],
] as const)('handles callback %j as %s', (params, outcome) => {
  expect(parseHandoff(callback(params), keys().privateKey).outcome).toBe(
    outcome,
  )
})
