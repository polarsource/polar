export const PAYOUT_ONBOARDING_RETURN_PARAM = 'payout_onboarding'
export const PAYOUT_ONBOARDING_ACCOUNT_PARAM = 'payout_account_id'

/**
 * Where Stripe sends the merchant after Connect onboarding. The marker tells the page it
 * is a return rather than an ordinary visit, and names the account that was onboarded —
 * which is not always the organization's active one.
 */
export const payoutOnboardingReturnPath = (
  organizationSlug: string,
  payoutAccountId?: string,
): string => {
  const params = new URLSearchParams({
    [PAYOUT_ONBOARDING_RETURN_PARAM]: 'return',
  })
  if (payoutAccountId) {
    params.set(PAYOUT_ONBOARDING_ACCOUNT_PARAM, payoutAccountId)
  }
  return `/dashboard/${organizationSlug}/finance/account?${params.toString()}`
}
