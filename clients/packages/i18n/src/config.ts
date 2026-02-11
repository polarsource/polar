export const SUPPORTED_LOCALES = ['en', 'nl', 'fr', 'sv', 'es'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'en'

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  nl: 'Dutch',
  sv: 'Swedish',
  es: 'Spanish',
  fr: 'French',
}
