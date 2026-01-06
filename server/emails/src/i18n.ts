// Import locale files directly from the i18n package (single source of truth)
import en from '../../../clients/packages/i18n/locales/en.json'
import nl from '../../../clients/packages/i18n/locales/nl.json'
import sv from '../../../clients/packages/i18n/locales/sv.json'

export const SUPPORTED_LOCALES = ['en', 'nl', 'sv'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'en'

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

type EmailTranslations = (typeof en)['email']

const translations: Record<SupportedLocale, EmailTranslations> = {
  en: en.email,
  nl: nl.email,
  sv: sv.email,
}

export function getEmailTranslations(
  locale: SupportedLocale = DEFAULT_LOCALE,
): EmailTranslations {
  return translations[locale] || translations[DEFAULT_LOCALE]
}
