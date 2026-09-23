import { describe, expect, it } from 'vitest'
import { isAllowedEmbedOrigin } from './embedOrigin'

describe('isAllowedEmbedOrigin', () => {
  it('matches exact and wildcard hosts without admitting sibling domains', () => {
    const hosts = ['merchant.example', '*.shops.example']

    expect(isAllowedEmbedOrigin('https://merchant.example', hosts)).toBe(true)
    expect(isAllowedEmbedOrigin('https://a.shops.example', hosts)).toBe(true)
    expect(isAllowedEmbedOrigin('https://shops.example', hosts)).toBe(false)
    expect(isAllowedEmbedOrigin('https://evilshops.example', hosts)).toBe(false)
    expect(isAllowedEmbedOrigin('https://evil.com', hosts)).toBe(false)
  })

  it('requires the configured port and a canonical origin', () => {
    const hosts = ['merchant.example:8443', 'localhost:3000']

    expect(isAllowedEmbedOrigin('https://merchant.example:8443', hosts)).toBe(
      true,
    )
    expect(isAllowedEmbedOrigin('https://merchant.example', hosts)).toBe(false)
    expect(isAllowedEmbedOrigin('http://localhost:3000', hosts)).toBe(true)
    expect(isAllowedEmbedOrigin('http://localhost:3001', hosts)).toBe(false)
    expect(isAllowedEmbedOrigin('http://merchant.example:8443', hosts)).toBe(
      false,
    )
    expect(
      isAllowedEmbedOrigin('https://merchant.example:8443/path', hosts),
    ).toBe(false)
  })
})
