import {
  type AcceptedLocale,
  DEFAULT_LOCALE,
  isAcceptedLocale,
} from '@polar-sh/i18n'
import { headers } from 'next/headers'

function getLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): AcceptedLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE

  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=')
      return {
        code: code.trim(),
        q: qValue ? parseFloat(qValue) : 1,
      }
    })
    .sort((a, b) => b.q - a.q)

  for (const { code } of languages) {
    if (isAcceptedLocale(code)) {
      return code as AcceptedLocale
    }
  }

  return DEFAULT_LOCALE
}

export async function resolveLocale(
  searchParamLocale?: string,
): Promise<AcceptedLocale> {
  if (searchParamLocale && isAcceptedLocale(searchParamLocale)) {
    return searchParamLocale
  }

  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language')

  return getLocaleFromAcceptLanguage(acceptLanguage)
}
