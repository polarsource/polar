export const SUPPORTED_LOCALES = ['en', 'nl'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = 'en'

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

export interface CheckoutTranslations {
  form: {
    email: string
    cardholderName: string
    billingAddress: string
    businessPurchase: string
    businessName: string
    taxId: string
    discountCode: string
    optional: string
    apply: string
    line1: string
    line2: string
    postalCode: string
    city: string
    required: string
  }
  pricing: {
    subtotal: string
    taxableAmount: string
    taxes: string
    total: string
    every: string
    additionalMeteredUsage: string
    free: string
    forFirstInterval: string
    forFirstMonths: string
    forFirstYears: string
    trial: string
    trialPlural: string
    trialEnds: string
  }
  buttons: {
    startTrial: string
    subscribe: string
    pay: string
    submit: string
  }
  footer: {
    merchantInfo: string
    poweredBy: string
  }
  errors: {
    paymentsUnavailable: string
  }
  confirmation: {
    processing: string
    success: string
    failed: string
    waitingWebhooks: string
    eligible: string
    tryAgain: string
    confirmPayment: string
    grantingBenefits: string
  }
}
