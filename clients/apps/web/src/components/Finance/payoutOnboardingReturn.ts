export const PAYOUT_ONBOARDING_RETURN_PARAM = 'payout_onboarding'

/**
 * Where Stripe sends the merchant after Connect onboarding. The marker is what
 * tells the page it is a return rather than an ordinary visit.
 */
export const payoutOnboardingReturnPath = (organizationSlug: string): string =>
  `/dashboard/${organizationSlug}/finance/account?${PAYOUT_ONBOARDING_RETURN_PARAM}=return`
