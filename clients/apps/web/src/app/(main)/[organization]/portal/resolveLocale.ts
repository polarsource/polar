import { getBrowserLocale } from '@/utils/i18n'
import {
  DEFAULT_LOCALE,
  isAcceptedLocale,
  type AcceptedLocale,
} from '@polar-sh/i18n'

export function resolvePortalLocale({
  localizationEnabled,
  localeParam,
  customerLocale,
  acceptLanguage,
}: {
  localizationEnabled: boolean
  localeParam?: string | null
  customerLocale?: string | null
  acceptLanguage?: string | null
}): AcceptedLocale {
  if (!localizationEnabled) {
    return DEFAULT_LOCALE
  }

  if (localeParam && isAcceptedLocale(localeParam)) {
    return localeParam
  }

  if (customerLocale && isAcceptedLocale(customerLocale)) {
    return customerLocale
  }

  return getBrowserLocale(acceptLanguage ?? null) ?? DEFAULT_LOCALE
}
