import { describe, expect, it, vi } from 'vitest'

vi.mock('./config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config')>()
  return {
    ...actual,
    SUPPORTED_LOCALES: [...actual.SUPPORTED_LOCALES, 'zh-TW'],
  }
})

import {
  getLocaleDirection,
  getTranslationLocale,
  isAcceptedLocale,
  SUPPORTED_LOCALES,
} from './index'

describe('isAcceptedLocale', () => {
  it('accepts a supported language', () => {
    expect(isAcceptedLocale('fr')).toBe(true)
  })

  it('accepts a region variant of a supported language', () => {
    expect(isAcceptedLocale('fr-CA')).toBe(true)
  })

  it('accepts a region-only supported locale', () => {
    expect(isAcceptedLocale('zh-TW')).toBe(true)
  })

  it('rejects another region of a region-only supported locale', () => {
    expect(isAcceptedLocale('zh-CN')).toBe(false)
  })

  it('rejects the bare language of a region-only supported locale', () => {
    expect(isAcceptedLocale('zh')).toBe(false)
  })

  it('rejects an unsupported language', () => {
    expect(isAcceptedLocale('xx')).toBe(false)
  })
})

describe('getTranslationLocale', () => {
  it('returns a region-only supported locale as is', () => {
    expect(getTranslationLocale('zh-TW' as never)).toBe('zh-TW')
  })
})

describe('getLocaleDirection', () => {
  it.each(['ar', 'ar-EG', 'he', 'he-IL', 'AR'])('is rtl for %s', (locale) => {
    expect(getLocaleDirection(locale)).toBe('rtl')
  })

  it.each([...SUPPORTED_LOCALES])(
    'is ltr for supported locale %s',
    (locale) => {
      expect(getLocaleDirection(locale)).toBe('ltr')
    },
  )

  it.each(['fa', 'ur', 'yi'])(
    'is ltr for right-to-left languages we do not ship (%s)',
    (locale) => {
      expect(getLocaleDirection(locale)).toBe('ltr')
    },
  )
})
