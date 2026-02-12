export const SUPPORTED_LOCALES = ['en', 'nl', 'fr', 'sv', 'es', 'de'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE = 'en' satisfies SupportedLocale

export type TranslatedLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  nl: 'Dutch',
  sv: 'Swedish',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
}
