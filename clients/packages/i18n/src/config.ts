export const SUPPORTED_LOCALES = ['en', 'nl'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE = 'en' satisfies SupportedLocale

export type TranslatedLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  nl: 'Dutch',
}
