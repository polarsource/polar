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

export async function resolveCheckoutLocale(
  searchParamLocale?: string,
  checkoutLocale?: string | null,
): Promise<SupportedLocale> {
  // 1. Query param takes priority
  if (searchParamLocale && isSupportedLocale(searchParamLocale)) {
    return searchParamLocale
  }

  // 2. Checkout's locale (forced or inherited from customer)
  if (checkoutLocale && isSupportedLocale(checkoutLocale)) {
    return checkoutLocale
  }

  // 3. Accept-Language header
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language')

  return getLocaleFromAcceptLanguage(acceptLanguage)
}
