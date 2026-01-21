import { useCallback } from 'react'

export const SUPPORTED_LOCALES = ['en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE = 'en'

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

import en from './locales/en.json'

export type Translations = typeof en

type LeafPaths<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${LeafPaths<T[K]>}`
        : K
    }[keyof T & string]
  : never

export type TranslationKey = LeafPaths<Translations>

const translations: Record<SupportedLocale, typeof en> = {
  en,
}

export function getTranslations(
  locale: SupportedLocale = DEFAULT_LOCALE,
): Translations {
  return translations[locale] ?? translations[DEFAULT_LOCALE]
}

export const useTranslations = (locale: SupportedLocale) => {
  return useCallback(
    (key: TranslationKey): string => {
      const translations = getTranslations(locale)

      return key
        .split('.')
        .reduce<unknown>(
          (obj, k) => (obj as Record<string, unknown>)[k],
          translations,
        ) as string
    },
    [locale],
  )
}
