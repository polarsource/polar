import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@polar-sh/i18n'
import { headers } from 'next/headers'

function getLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): SupportedLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE

  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=')
      return {
        code: code.split('-')[0].toLowerCase(),
        q: qValue ? parseFloat(qValue) : 1,
      }
    })
    .sort((a, b) => b.q - a.q)

  for (const { code } of languages) {
    if (SUPPORTED_LOCALES.includes(code as SupportedLocale)) {
      return code as SupportedLocale
    }
  }

  return DEFAULT_LOCALE
}

export async function resolveLocale(
  searchParamLocale?: string,
): Promise<SupportedLocale> {
  if (searchParamLocale && isSupportedLocale(searchParamLocale)) {
    return searchParamLocale
  }

  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language')

  return getLocaleFromAcceptLanguage(acceptLanguage)
}
