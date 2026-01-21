import { headers } from 'next/headers'
import { enMessages, loadLocale } from './messages'
import type { SupportedLocale } from './provider'
import type { Messages } from './types'

const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'sv', 'es', 'fr', 'nl']

function detectLocaleFromHeader(acceptLanguage: string | null): SupportedLocale {
  if (!acceptLanguage) return 'en'

  const preferred = acceptLanguage
    .split(',')
    .map((lang) => lang.split(';')[0].trim().split('-')[0])
    .find((lang) => SUPPORTED_LOCALES.includes(lang as SupportedLocale))

  return (preferred as SupportedLocale) ?? 'en'
}

export interface LocaleData {
  locale: SupportedLocale
  messages: Messages
}

export async function getLocaleData(): Promise<LocaleData> {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language')
  const locale = detectLocaleFromHeader(acceptLanguage)
  const messages = locale === 'en' ? enMessages : await loadLocale(locale)

  return { locale, messages }
}
