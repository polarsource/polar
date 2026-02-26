import type { AcceptedLocale, SupportedLocale } from '@polar-sh/i18n'
import { getTranslationLocale, isSupportedLocale } from '@polar-sh/i18n'
import type { StripeElementLocale } from '@stripe/stripe-js'

export const convertLocaleToStripeElementLocale = (
  locale: AcceptedLocale | SupportedLocale,
): StripeElementLocale => {
  const supported = isSupportedLocale(locale)
    ? locale
    : getTranslationLocale(locale)

  switch (supported) {
    case 'pt-PT':
      return 'pt'
    default:
      return supported satisfies StripeElementLocale
  }
}
