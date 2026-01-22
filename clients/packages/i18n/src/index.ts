import { useCallback } from 'react'

export const SUPPORTED_LOCALES = ['en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE = 'en'

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

// import en from './locales/en.json'

const en = {
  checkout: {
    poweredBy: 'Powered by',
  },
  playground: {
    interpolation: 'This is a {test}',
  },
} as const

export type Translations = typeof en

type LeafPaths<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${LeafPaths<T[K]>}`
        : K
    }[keyof T & string]
  : never

export type TranslationKey = LeafPaths<Translations>

// Get the literal string value at a dot-separated path
type ValueAtPath<
  T,
  Path extends string,
> = Path extends `${infer First}.${infer Rest}`
  ? First extends keyof T
    ? ValueAtPath<T[First], Rest>
    : never
  : Path extends keyof T
    ? T[Path]
    : never

// Recursively extract {placeholder} names from a string
type ExtractPlaceholders<S extends string> =
  S extends `${string}{${infer Key}}${infer Rest}`
    ? Key | ExtractPlaceholders<Rest>
    : never

// Build the interpolations type for a given key
type InterpolationsFor<K extends TranslationKey> = ExtractPlaceholders<
  ValueAtPath<Translations, K> & string
>

// The translate function type with conditional interpolations
type TranslateFn = <K extends TranslationKey>(
  key: K,
  ...args: InterpolationsFor<K> extends never
    ? []
    : [
        interpolations: Record<
          InterpolationsFor<K>,
          string | { toString(): string }
        >,
      ]
) => string

const translations: Record<SupportedLocale, typeof en> = {
  en,
}

export function getTranslations(
  locale: SupportedLocale = DEFAULT_LOCALE,
): Translations {
  return translations[locale] ?? translations[DEFAULT_LOCALE]
}

export const useTranslations = (locale: SupportedLocale): TranslateFn => {
  return useCallback(
    (
      key: TranslationKey,
      interpolations?: Record<string, string | { toString(): string }>,
    ): string => {
      const translations = getTranslations(locale)

      const template = key
        .split('.')
        .reduce<unknown>(
          (obj, k) => (obj as Record<string, unknown>)[k],
          translations,
        ) as string

      if (!interpolations) {
        return template
      }

      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, interpolationKey) => {
        const value = interpolations[interpolationKey]

        if (value === undefined) {
          return `{${interpolationKey}}`
        }

        return value.toString()
      })
    },
    [locale],
  )
}
