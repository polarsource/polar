import {
  type AcceptedLocale,
  DEFAULT_LOCALE,
  isAcceptedLocale,
} from '@polar-sh/i18n'
import { headers } from 'next/headers'

export function parseAcceptLanguageHeader(
  acceptLanguageHeader: string | null,
): { code: string; q: number }[] {
  if (!acceptLanguageHeader) return []

  return acceptLanguageHeader
    .split(',')
    .map((lang) => {
      const [code, qValue] = lang.trim().split(';q=')
      return {
        code: code.trim(),
        q: qValue ? parseFloat(qValue) : 1,
      }
    })
    .sort((a, b) => b.q - a.q)
}

function getLocaleFromAcceptLanguageHeader(
  acceptLanguageHeader: string | null,
): AcceptedLocale {
  const languages = parseAcceptLanguageHeader(acceptLanguageHeader)

  for (const { code } of languages) {
    if (isAcceptedLocale(code)) {
      return code as AcceptedLocale
    }
  }

  return DEFAULT_LOCALE
}

function getPrimaryLanguageForLocale(locale: string): string {
  return locale.split('-')[0].toLowerCase()
}

export function findMatchingLocaleInAcceptLanguageHeader(
  acceptLanguageHeader: string | null,
  targetLocale: AcceptedLocale,
): AcceptedLocale | null {
  const languages = parseAcceptLanguageHeader(acceptLanguageHeader)

  const matchingLocale = languages.find(
    ({ code }) =>
      getPrimaryLanguageForLocale(code) ===
      getPrimaryLanguageForLocale(targetLocale),
  )

  if (!matchingLocale) return null

  if (isAcceptedLocale(matchingLocale.code)) {
    return matchingLocale.code as AcceptedLocale
  }

  return null
}

export async function resolveLocale(
  searchParamLocale?: string,
  checkoutLocale?: string | null,
): Promise<AcceptedLocale> {
  if (searchParamLocale && isAcceptedLocale(searchParamLocale)) {
    return searchParamLocale
  }

  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language')

  const headerLocale = getLocaleFromAcceptLanguageHeader(acceptLanguage)

  if (checkoutLocale && isAcceptedLocale(checkoutLocale)) {
    // If there's a primary language match, allow the header locale to switch region tags within the same primary language
    // For example, switch `en` or `en-US` to `en-CA`. This can happen with our default locale or if the API
    // has set a too specific locale that doesn't match the user's preferred locales but does match the primary language.
    // This is helpful for currency & date formatting.
    const matchingPrimaryLanguageLocale =
      findMatchingLocaleInAcceptLanguageHeader(acceptLanguage, checkoutLocale)

    if (matchingPrimaryLanguageLocale) {
      return matchingPrimaryLanguageLocale
    }

    return checkoutLocale
  }

  return headerLocale
}
