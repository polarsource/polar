import { useCallback } from 'react'

export { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES } from './config'
export type { AcceptedLocale, SupportedLocale } from './config'
export type { TranslateFn, TranslationKey, Translations } from './types'

import type { AcceptedLocale, SupportedLocale } from './config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config'
import type { LocaleShape, TranslateFn, Translations } from './types'

export function getTranslationLocale(locale: AcceptedLocale): SupportedLocale {
  if (SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale
  }
  const language = locale.split('-')[0].toLowerCase()
  if (SUPPORTED_LOCALES.includes(language as SupportedLocale)) {
    return language as SupportedLocale
  }
  return DEFAULT_LOCALE
}

export function isAcceptedLocale(value: string): value is AcceptedLocale {
  const language = value.split('-')[0].toLowerCase()
  return SUPPORTED_LOCALES.includes(language as SupportedLocale)
}

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

import de from './locales/de'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import hu from './locales/hu'
import nl from './locales/nl'
import sv from './locales/sv'

const translations: Record<SupportedLocale, LocaleShape<Translations>> = {
  en,
  nl,
  sv,
  fr,
  es,
  de,
  hu,
}

export function getTranslations(
  locale: AcceptedLocale = DEFAULT_LOCALE,
): Translations {
  const translationLocale = getTranslationLocale(locale)
  return (translations[translationLocale] ??
    translations[DEFAULT_LOCALE]) as Translations
}

export const useTranslations = (locale: AcceptedLocale): TranslateFn => {
  return useCallback(
    ((key: string, interpolations?: Record<string, unknown>) => {
      const translations = getTranslations(locale)

      const value = key
        .split('.')
        .reduce<unknown>(
          (obj, k) => (obj as Record<string, unknown>)[k],
          translations,
        )

      // Handle plural objects
      if (
        typeof value === 'object' &&
        value !== null &&
        '_mode' in value &&
        (value as { _mode: string })._mode === 'plural'
      ) {
        const pluralObj = value as Record<string, string>
        const count = (interpolations as { count: number })?.count ?? 0

        // Exact match first (=0, =1, etc.), then fall back to 'other'
        const template = pluralObj[`=${count}`] ?? pluralObj.other

        // Replace # with count, then handle other interpolations
        let result = template.replace(/#/g, count.toString())

        if (interpolations) {
          result = result.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
            const val = interpolations[k]
            return val === undefined ? `{${k}}` : String(val)
          })
        }

        return result
      }

      // Handle annotated entries — extract the value string
      const template =
        typeof value === 'object' &&
        value !== null &&
        'value' in value &&
        typeof (value as { value: unknown }).value === 'string'
          ? (value as { value: string }).value
          : (value as string)

      if (!interpolations) {
        return template
      }

      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
        const val = interpolations[k]
        return val === undefined ? `{${k}}` : String(val)
      })
    }) as TranslateFn,
    [locale],
  )
}
