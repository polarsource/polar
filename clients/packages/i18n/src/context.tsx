import type { CheckoutTranslations, SupportedLocale } from './types'
import { DEFAULT_LOCALE } from './types'
import en from '../locales/en.json'
import nl from '../locales/nl.json'

const translations: Record<SupportedLocale, CheckoutTranslations> = {
  en: en as CheckoutTranslations,
  nl: nl as CheckoutTranslations,
}

export function getTranslations(
  locale: SupportedLocale = DEFAULT_LOCALE,
): CheckoutTranslations {
  return translations[locale] ?? translations[DEFAULT_LOCALE]
}
