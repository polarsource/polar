import { useCallback } from 'react'

export { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES } from './config'
export type { AcceptedLocale, SupportedLocale } from './config'
export type { TranslateFn, TranslationKey, Translations } from './types'

import type { AcceptedLocale, SupportedLocale } from './config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config'
import type {
  DeepPartialLocale,
  LocaleShape,
  TranslateFn,
  Translations,
} from './types'

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
import it from './locales/it'
import nl from './locales/nl'
import pt from './locales/pt'
import ptPT from './locales/pt-PT'
import sv from './locales/sv'
import ko from './locales/ko'

type LocalesRecord = { en: LocaleShape<Translations> } & Record<
  Exclude<SupportedLocale, 'en'>,
  DeepPartialLocale<LocaleShape<Translations>>
>

const translations: LocalesRecord = {
  en,
  nl,
  sv,
  fr,
  es,
  de,
  hu,
  it,
  pt,
  'pt-PT': ptPT,
  ko,
}

const isAtomicLeaf = (v: unknown): boolean => {
  if (v === null || typeof v !== 'object') return true
  if ('_mode' in v) return true
  const value = (v as { value?: unknown }).value
  if (typeof value === 'string') return true
  return false
}

const deepMerge = (base: unknown, override: unknown): unknown => {
  if (override === undefined) return base
  if (isAtomicLeaf(override) || isAtomicLeaf(base)) return override
  const result: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  }
  for (const key of Object.keys(override as Record<string, unknown>)) {
    result[key] = deepMerge(
      (base as Record<string, unknown>)[key],
      (override as Record<string, unknown>)[key],
    )
  }
  return result
}

const mergedCache = new Map<SupportedLocale, Translations>()

export function getTranslations(
  locale: AcceptedLocale = DEFAULT_LOCALE,
): Translations {
  const translationLocale = getTranslationLocale(locale)
  if (translationLocale === DEFAULT_LOCALE) return en
  const cached = mergedCache.get(translationLocale)
  if (cached) return cached
  const merged = deepMerge(en, translations[translationLocale]) as Translations
  mergedCache.set(translationLocale, merged)
  return merged
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
