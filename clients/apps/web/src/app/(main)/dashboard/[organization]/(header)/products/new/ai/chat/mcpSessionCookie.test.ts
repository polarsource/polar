import { describe, expect, it } from 'vitest'
import {
  parseMCPSessionCookie,
  serializeMCPSessionCookie,
} from './mcpSessionCookie'

const ORGANIZATION_ID = 'e2c8a9d0-1234-4f56-8a9b-0c1d2e3f4a5b'
const OTHER_ORGANIZATION_ID = 'f3d9b0e1-5678-4a9b-8c0d-1e2f3a4b5c6d'
const TOKEN = 'polar_oat_test'

describe('parseMCPSessionCookie', () => {
  it('returns the token when the cookie was minted for the same organization', () => {
    const value = serializeMCPSessionCookie(ORGANIZATION_ID, TOKEN)
    expect(parseMCPSessionCookie(value, ORGANIZATION_ID)).toBe(TOKEN)
  })

  it('returns null when the cookie was minted for another organization', () => {
    const value = serializeMCPSessionCookie(OTHER_ORGANIZATION_ID, TOKEN)
    expect(parseMCPSessionCookie(value, ORGANIZATION_ID)).toBeNull()
  })

  it('returns null for a legacy bare-token cookie value', () => {
    expect(parseMCPSessionCookie(TOKEN, ORGANIZATION_ID)).toBeNull()
  })

  it('returns null for malformed JSON payloads', () => {
    expect(
      parseMCPSessionCookie('{"organizationId":', ORGANIZATION_ID),
    ).toBeNull()
    expect(
      parseMCPSessionCookie(
        JSON.stringify({ organizationId: ORGANIZATION_ID }),
        ORGANIZATION_ID,
      ),
    ).toBeNull()
    expect(
      parseMCPSessionCookie(
        JSON.stringify({ organizationId: ORGANIZATION_ID, token: 42 }),
        ORGANIZATION_ID,
      ),
    ).toBeNull()
  })
})
