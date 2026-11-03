import { describe, expect, it } from 'vitest'
import {
  encryptForCLI,
  getCLICancelURL,
  getCLIHandoff,
  getRequestedScopes,
} from './handoff'

const generateCLIKeys = async () => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  )
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  return { privateKey, publicKey: Buffer.from(spki).toString('base64url') }
}

describe('getCLIHandoff', () => {
  it('requires both the state and the public key', () => {
    expect(getCLIHandoff(new URLSearchParams('state=s'))).toBeNull()
    expect(getCLIHandoff(new URLSearchParams('public_key=k'))).toBeNull()
    expect(getCLIHandoff(new URLSearchParams('state=s&public_key=k'))).toEqual({
      state: 's',
      publicKey: 'k',
    })
  })
})

describe('getRequestedScopes', () => {
  it('keeps only scopes an organization token can have', () => {
    expect(
      getRequestedScopes(
        new URLSearchParams('scopes=products:read,web:write,nope'),
      ),
    ).toEqual(['products:read'])
  })
})

describe('encryptForCLI', () => {
  it('encrypts the token so only the CLI private key can read it', async () => {
    const { privateKey, publicKey } = await generateCLIKeys()
    const encrypted = await encryptForCLI(publicKey, 'polar_oat_secret')

    expect(encrypted).not.toContain('polar_oat_secret')
    const decrypted = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      Buffer.from(encrypted, 'base64url'),
    )
    expect(new TextDecoder().decode(decrypted)).toBe('polar_oat_secret')
  })
})

describe('getCLICancelURL', () => {
  it('only ever targets the local CLI', () => {
    expect(getCLICancelURL({ state: 's', publicKey: 'k' })).toBe(
      'http://127.0.0.1:3333/token/callback?state=s&error=access_denied',
    )
  })
})
