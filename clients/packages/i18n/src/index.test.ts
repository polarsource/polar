import { describe, expect, it } from 'vitest'
import { getTranslations } from './index'

function t(
  locale: string,
  key: string,
  interpolations?: Record<string, unknown>,
): string {
  const localeTranslations = getTranslations(locale)
  const fallbackTranslations = getTranslations('en')

  const resolve = (obj: unknown, path: string[]): unknown =>
    path.reduce<unknown>(
      (o, k) => (o != null ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    )

  const parts = key.split('.')
  const value =
    resolve(localeTranslations, parts) ?? resolve(fallbackTranslations, parts)

  const template =
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof (value as { value: unknown }).value === 'string'
      ? (value as { value: string }).value
      : (value as string)

  if (!interpolations) return template

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
    const val = interpolations[k]
    return val === undefined ? `{${k}}` : String(val)
  })
}

describe('i18n fallback behavior', () => {
  it('returns English string for a key that exists in en', () => {
    expect(t('en', 'checkout.footer.poweredBy')).toBe('Powered by')
  })

  it('returns translated string when locale has the key', () => {
    expect(t('sv', 'checkout.footer.poweredBy')).toBe('Drivs av')
  })

  it('falls back to English when locale is missing a key', () => {
    expect(t('sv', 'checkout.footer.buyerTermsLink')).toBe('Buyer Terms')
  })

  it('falls back to English for deeply nested missing keys', () => {
    expect(t('sv', 'checkout.productSwitcher.fromPrefix')).toBe('From')
  })

  it('handles interpolation in fallback strings', () => {
    expect(
      t('sv', 'checkout.footer.mandateOneTime', { buttonLabel: 'Pay now' }),
    ).toContain('Pay now')
  })

  it('returns English for completely unknown locale prefix', () => {
    expect(t('ja', 'checkout.footer.poweredBy')).toBe('Powered by')
  })

  it('does not crash on nonexistent key path', () => {
    const result = t('en', 'checkout.this.does.not.exist')
    expect(result).toBeUndefined()
  })

  it('falls back for a key where parent object exists but leaf is missing', () => {
    expect(t('sv', 'checkout.footer.buyerTermsLink')).toBe('Buyer Terms')
  })

  it('prefers locale translation over English when both exist', () => {
    expect(t('sv', 'checkout.form.cardholderName')).toBe('Kortinnehavare')
    expect(t('en', 'checkout.form.cardholderName')).toBe('Cardholder name')
  })
})
