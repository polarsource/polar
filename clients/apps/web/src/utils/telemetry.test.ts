import { describe, expect, it } from 'vitest'
import { redactClaimTokens } from './telemetry'

const TOKEN = 'polar_acl_Ab3dEf9hIjKlMnOpQrStUvWxYz0123456789abc0Xy1Z'

describe('redactClaimTokens', () => {
  it.each([
    [
      'claim page URL',
      `https://polar.sh/agent/claim?token=${TOKEN}&resume=1`,
      'https://polar.sh/agent/claim?token={link_token}&resume=1',
    ],
    [
      'encoded return_to',
      `/auth?return_to=%2Fagent%2Fclaim%3Ftoken%3D${TOKEN}`,
      '/auth?return_to=%2Fagent%2Fclaim%3Ftoken%3D{link_token}',
    ],
    [
      'claim summary API path',
      `GET https://api.polar.sh/v1/agent/claim/${TOKEN}`,
      'GET https://api.polar.sh/v1/agent/claim/{link_token}',
    ],
    [
      'other URL',
      'https://polar.sh/dashboard?token=polar_oat_x',
      'https://polar.sh/dashboard?token=polar_oat_x',
    ],
  ])('%s', (_, value, expected) => {
    expect(redactClaimTokens(value)).toBe(expected)
  })

  it('redacts nested values without mutating the input', () => {
    const timestamp = new Date()
    const breadcrumb = {
      category: 'navigation',
      data: { from: '/', to: `/agent/claim?token=${TOKEN}` },
      spans: [{ description: `GET /v1/agent/claim/${TOKEN}` }],
      timestamp,
    }

    expect(redactClaimTokens(breadcrumb)).toEqual({
      category: 'navigation',
      data: { from: '/', to: '/agent/claim?token={link_token}' },
      spans: [{ description: 'GET /v1/agent/claim/{link_token}' }],
      timestamp,
    })
    expect(breadcrumb.data.to).toContain(TOKEN)
  })

  it('replaces circular references instead of returning the unredacted ancestor', () => {
    const data: Record<string, unknown> = { url: `/agent/claim?token=${TOKEN}` }
    data.self = data

    expect(redactClaimTokens(data)).toEqual({
      url: '/agent/claim?token={link_token}',
      self: '[Circular]',
    })
  })

  it('redacts URL instances and keeps them as URLs', () => {
    const redacted = redactClaimTokens({
      url: new URL(`https://polar.sh/agent/claim?token=${TOKEN}`),
    }).url

    expect(redacted).toBeInstanceOf(URL)
    expect(redacted.href).not.toContain(TOKEN)
    expect(redacted.searchParams.get('token')).toBe('{link_token}')
  })
})
