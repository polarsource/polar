import { useCallback } from 'react'

export { DEFAULT_LOCALE, LOCALE_NAMES, SUPPORTED_LOCALES } from './config'
export type { AcceptedLocale, SupportedLocale } from './config'

import type { AcceptedLocale, SupportedLocale } from './config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config'

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

export type Translations = typeof en

type LeafPaths<T> = T extends object
  ? '_mode' extends keyof T
    ? never
    : '_llmContext' extends keyof T
      ? never
      : {
          [K in keyof T & string]: '_mode' extends keyof T[K]
            ? K
            : '_llmContext' extends keyof T[K]
              ? K
              : T[K] extends object
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

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

type StringShape<S extends string> =
  ExtractPlaceholders<S> extends never
    ? string
    : UnionToIntersection<
        ExtractPlaceholders<S> extends infer P extends string
          ? `${string}{${P}}${string}`
          : never
      >

type PluralShape<T> = {
  [K in keyof T]: K extends '_mode'
    ? T[K]
    : T[K] extends string
      ? StringShape<T[K]>
      : T[K]
}

type AnnotatedEntryShape<T extends { value: string }> =
  | StringShape<T['value']>
  | { value: StringShape<T['value']>; _llmContext: string }

type LocaleShape<T> = {
  [K in keyof T]: T[K] extends { _mode: string }
    ? PluralShape<T[K]>
    : T[K] extends { value: string; _llmContext: string }
      ? AnnotatedEntryShape<T[K]>
      : T[K] extends string
        ? StringShape<T[K]>
        : T[K] extends object
          ? LocaleShape<T[K]>
          : T[K]
}

// Get all required interpolation keys for a translation key
// Plurals always require 'count' + any {placeholders} in the templates
type InterpolationKeys<K extends TranslationKey> =
  ValueAtPath<Translations, K> extends infer V
    ? '_mode' extends keyof V
      ? 'count' | ExtractPlaceholders<V[Exclude<keyof V, '_mode'>] & string>
      : V extends { value: infer S extends string }
        ? ExtractPlaceholders<S>
        : V extends string
          ? ExtractPlaceholders<V>
          : never
    : never

type InterpolationValue = string | number | { toString(): string }

type InterpolationsRecord<Keys extends string> = {
  [K in Keys]: K extends 'count' ? number : InterpolationValue
}

// The translate function type with conditional interpolations
type TranslateFn = <K extends TranslationKey>(
  key: K,
  ...args: InterpolationKeys<K> extends never
    ? []
    : [interpolations: InterpolationsRecord<InterpolationKeys<K>>]
) => string

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
