export const SUPPORTED_LOCALES = [
  'en',
  'nl',
  'fr',
  'sv',
  'es',
  'de',
  'hu',
  'it',
  'pt',
  'pt-PT',
] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE = 'en' satisfies SupportedLocale

export type TranslatedLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>

// Expand bare language codes to include region variants,
// but keep region-specific codes (like future 'pt-BR') exact
type Alpha =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'

type ResolveBCP47<T extends string> = T extends `${string}-${string}`
  ? T
  : T | `${T}-${Alpha}${Alpha}`

export type AcceptedLocale = ResolveBCP47<SupportedLocale>

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  nl: 'Dutch',
  sv: 'Swedish',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  hu: 'Hungarian',
  it: 'Italian',
  pt: 'Portuguese (Brazilian)',
  'pt-PT': 'Portuguese (Portugal)',
}
