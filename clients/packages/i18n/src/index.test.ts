import { describe, expect, it } from 'vitest'
import { getTranslationLocale, isAcceptedLocale } from './index'

describe('isAcceptedLocale', () => {
  it('accepts a region-specific supported locale without its bare language', () => {
    expect(isAcceptedLocale('zh-TW')).toBe(true)
  })

  it('accepts a region variant of a supported language', () => {
    expect(isAcceptedLocale('de-AT')).toBe(true)
  })

  it('rejects an unsupported region of a region-only locale', () => {
    expect(isAcceptedLocale('zh-CN')).toBe(false)
  })
})

describe('getTranslationLocale', () => {
  it('resolves a region-specific supported locale exactly', () => {
    expect(getTranslationLocale('zh-TW')).toBe('zh-TW')
  })
})
