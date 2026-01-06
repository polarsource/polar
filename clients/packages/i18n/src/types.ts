export const SUPPORTED_LOCALES = ['en', 'nl', 'sv'] as const
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
    country: string
    state: string
    province: string
    stateOrProvince: string
    included: string
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
    payWhatYouWant: string
    perUnit: string
    perSeat: string
    numberOfSeats: string
    billed: string
    oneTimePurchase: string
    interval: {
      day: string
      week: string
      month: string
      year: string
    }
    frequency: {
      daily: string
      weekly: string
      monthly: string
      yearly: string
      every: string
    }
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
  email: EmailTranslations
}

export interface EmailTranslations {
  common: {
    accessPurchase: string
    manageSubscription: string
    viewSubscription: string
    completePayment: string
    troubleWithButton: string
  }
  orderConfirmation: {
    subject: string
    preview: string
    heading: string
    processed: string
  }
  subscriptionConfirmation: {
    subject: string
    preview: string
    heading: string
    active: string
  }
  subscriptionCycled: {
    subject: string
    preview: string
    heading: string
    renewed: string
  }
  subscriptionCancellation: {
    subject: string
    preview: string
    heading: string
    sorryToSeeYouGo: string
    changeYourMind: string
    benefitsContinue: string
  }
  subscriptionPastDue: {
    subject: string
    preview: string
    heading: string
    paymentFailed: string
    updatePayment: string
  }
  subscriptionRevoked: {
    subject: string
    preview: string
    heading: string
    thankYou: string
    welcomeBack: string
  }
  subscriptionUncanceled: {
    subject: string
    preview: string
    heading: string
    noLongerCanceled: string
  }
  subscriptionUpdated: {
    subject: string
    preview: string
    heading: string
    changedTo: string
    immediateWithCharge: string
    immediateNextCycle: string
  }
}
