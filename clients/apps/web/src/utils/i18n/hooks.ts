import {
  type AcceptedLocale,
  type TranslationKey,
  getTranslations,
} from '@polar-sh/i18n'
import { useCallback } from 'react'

export const useTranslations = (locale: AcceptedLocale) => {
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
