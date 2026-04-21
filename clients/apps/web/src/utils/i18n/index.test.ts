import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/i18n', () => {
  const SUPPORTED_LOCALES = ['en', 'fr', 'nl'] as const
  return {
    DEFAULT_LOCALE: 'en',
    SUPPORTED_LOCALES,
    isAcceptedLocale: (value: string) => {
      const language = value.split('-')[0].toLowerCase()
      return (SUPPORTED_LOCALES as readonly string[]).includes(language)
    },
  }
})

const headerGet = vi.fn<(name: string) => string | null>()

vi.mock('next/headers', () => ({
  headers: () => ({ get: headerGet }),
}))

import {
  findMatchingLocaleInAcceptLanguageHeader,
  parseAcceptLanguageHeader,
  resolveLocale,
} from './index'

describe('parseAcceptLanguageHeader', () => {
  it('returns [] for null', () => {
    expect(parseAcceptLanguageHeader(null)).toEqual([])
  })

  it('returns [] for empty string', () => {
    expect(parseAcceptLanguageHeader('')).toEqual([])
  })

  it('parses a single code with default q=1', () => {
    expect(parseAcceptLanguageHeader('fr')).toEqual([{ code: 'fr', q: 1 }])
  })

  it('sorts entries by descending q', () => {
    expect(parseAcceptLanguageHeader('fr;q=0.3,nl;q=0.9,en-CA;q=0.7')).toEqual([
      { code: 'nl', q: 0.9 },
      { code: 'en-CA', q: 0.7 },
      { code: 'fr', q: 0.3 },
    ])
  })
})

describe('findMatchingLocaleInAcceptLanguageHeader', () => {
  it('returns the header region variant sharing the target primary language', () => {
    expect(
      findMatchingLocaleInAcceptLanguageHeader('en-CA,fr;q=0.8', 'en-US'),
    ).toBe('en-CA')
  })

  it('returns null when no header code shares the target primary language', () => {
    expect(
      findMatchingLocaleInAcceptLanguageHeader('fr,nl;q=0.8', 'en-US'),
    ).toBeNull()
  })

  it('returns null when there is no match', () => {
    expect(findMatchingLocaleInAcceptLanguageHeader('xx', 'en-US')).toBeNull()
  })
})

describe('resolveLocale', () => {
  beforeEach(() => {
    headerGet.mockReset()
  })

  it('returns searchParamLocale when it is accepted', async () => {
    headerGet.mockReturnValue('nl')
    await expect(resolveLocale('fr', 'en-CA')).resolves.toBe('fr')
  })

  it('falls through to the header when searchParamLocale is unsupported', async () => {
    headerGet.mockReturnValue('nl')
    await expect(resolveLocale('xx')).resolves.toBe('nl')
  })

  it('returns the first accepted header code when no search param or checkout locale is given', async () => {
    headerGet.mockReturnValue('xx,fr;q=0.9')
    await expect(resolveLocale()).resolves.toBe('fr')
  })

  it('returns DEFAULT_LOCALE when nothing matches', async () => {
    headerGet.mockReturnValue('xx,yy;q=0.5')
    await expect(resolveLocale()).resolves.toBe('en')
  })

  it('overrides checkoutLocale with region within the same primary language', async () => {
    headerGet.mockReturnValue('en-US')
    await expect(resolveLocale(undefined, 'en-CA')).resolves.toBe('en-US')
  })

  it('keeps checkoutLocale when no header entry shares its primary language', async () => {
    headerGet.mockReturnValue('fr')
    await expect(resolveLocale(undefined, 'en-CA')).resolves.toBe('en-CA')
  })

  it('falls back to the header locale when checkoutLocale is unsupported', async () => {
    headerGet.mockReturnValue('nl')
    await expect(resolveLocale(undefined, 'xx')).resolves.toBe('nl')
  })
})
