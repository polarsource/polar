import { schemas } from '@polar-sh/client'

export const STEP_LABELS: Record<
  schemas['OrganizationReviewCheckKey'],
  string
> = {
  'identity.email': 'Support email',
  'identity.social_links': 'Social links',
  'identity.stripe_identity_verification': 'Identity verification',
  product_description: 'Product description',
  product_url: 'Product website',
  payout_account: 'Payout account',
  product_configuration: 'Product configuration',
  setup_readiness: 'Checkout integration',
}
