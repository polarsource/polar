export const RESOLUTION_DOMAINS = ['product', 'country', 'identity'] as const

export type ResolutionDomain = (typeof RESOLUTION_DOMAINS)[number]

export type ProductResolution =
  | 'map_existing_pro'
  | 'create_separate_product'
  | 'leave_on_stripe'

export type CountryResolution =
  | { disposition: 'set_country'; country: string }
  | { disposition: 'leave_on_stripe' }

export type IdentityResolution =
  | 'link_existing_customer'
  | 'create_separate_customer'
  | 'leave_on_stripe'

export interface ResolutionChoices {
  product: ProductResolution | null
  country: CountryResolution | null
  identity: IdentityResolution | null
}

export const SUGGESTED_BILLING_COUNTRY = 'United Kingdom'

export const emptyResolutionChoices = (): ResolutionChoices => ({
  product: null,
  country: null,
  identity: null,
})

export const confirmSuggestedBillingCountry = (): CountryResolution => ({
  disposition: 'set_country',
  country: SUGGESTED_BILLING_COUNTRY,
})

export const recommendedResolutionChoices = (): ResolutionChoices => ({
  product: 'map_existing_pro',
  country: confirmSuggestedBillingCountry(),
  identity: 'link_existing_customer',
})

export const getResolutionCompletionCount = (
  resolutions: ResolutionChoices,
): number =>
  RESOLUTION_DOMAINS.filter((domain) => resolutions[domain] !== null).length

export const isResolutionComplete = (resolutions: ResolutionChoices): boolean =>
  getResolutionCompletionCount(resolutions) === RESOLUTION_DOMAINS.length

export function getProductResolutionLabel(choice: ProductResolution): string {
  switch (choice) {
    case 'map_existing_pro':
      return 'Map to existing Polar Pro'
    case 'create_separate_product':
      return 'Create a separate Polar product'
    case 'leave_on_stripe':
      return 'Leave affected subscriptions on Stripe'
  }
}

export function getProductResolutionImpact(choice: ProductResolution): string {
  switch (choice) {
    case 'map_existing_pro':
      return 'Affects 1 subscription ($19 MRR). Stripe Pro subscriptions import onto the existing Polar Pro product.'
    case 'create_separate_product':
      return 'Affects 1 subscription ($19 MRR). Stripe Pro becomes its own Polar product instead of reusing Polar Pro.'
    case 'leave_on_stripe':
      return 'Affects 1 subscription ($19 MRR). Retains Stripe ownership — colliding Pro subscriptions stay billed on Stripe.'
  }
}

export function getCountryResolutionLabel(choice: CountryResolution): string {
  if (choice.disposition === 'leave_on_stripe') {
    return 'Leave missing-country subscription on Stripe'
  }
  if (choice.country === SUGGESTED_BILLING_COUNTRY) {
    return 'Confirm United Kingdom'
  }
  return `Use billing country ${choice.country}`
}

export function getCountryResolutionImpact(choice: CountryResolution): string {
  if (choice.disposition === 'leave_on_stripe') {
    return 'Affects 1 subscription ($19 MRR). Retains Stripe ownership — the missing-country record stays billed on Stripe.'
  }
  return `Affects 1 subscription ($19 MRR). Billing country set to ${choice.country} from card evidence or merchant choice.`
}

export function getIdentityResolutionLabel(choice: IdentityResolution): string {
  switch (choice) {
    case 'link_existing_customer':
      return 'Link to existing Polar customer'
    case 'create_separate_customer':
      return 'Create a separate Polar customer'
    case 'leave_on_stripe':
      return 'Leave conflicting customer on Stripe'
  }
}

export function getIdentityResolutionImpact(
  choice: IdentityResolution,
): string {
  switch (choice) {
    case 'link_existing_customer':
      return 'Affects 1 subscription ($9 MRR). The Stripe identity merges onto the existing Polar customer with this email.'
    case 'create_separate_customer':
      return 'Affects 1 subscription ($9 MRR). A second Polar customer is created for this Stripe identity.'
    case 'leave_on_stripe':
      return 'Affects 1 subscription ($9 MRR). Retains Stripe ownership — the email conflict stays billed on Stripe.'
  }
}

export function getResolutionChoiceLabel(
  domain: ResolutionDomain,
  resolutions: ResolutionChoices,
): string | null {
  if (domain === 'product') {
    return resolutions.product
      ? getProductResolutionLabel(resolutions.product)
      : null
  }
  if (domain === 'country') {
    return resolutions.country
      ? getCountryResolutionLabel(resolutions.country)
      : null
  }
  return resolutions.identity
    ? getIdentityResolutionLabel(resolutions.identity)
    : null
}

export function getResolutionChoiceImpact(
  domain: ResolutionDomain,
  resolutions: ResolutionChoices,
): string | null {
  if (domain === 'product') {
    return resolutions.product
      ? getProductResolutionImpact(resolutions.product)
      : null
  }
  if (domain === 'country') {
    return resolutions.country
      ? getCountryResolutionImpact(resolutions.country)
      : null
  }
  return resolutions.identity
    ? getIdentityResolutionImpact(resolutions.identity)
    : null
}
