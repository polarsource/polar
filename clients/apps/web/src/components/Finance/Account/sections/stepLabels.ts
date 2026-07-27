import { schemas } from '@polar-sh/client'

export const STEP_LABELS: Record<
  schemas['OrganizationReviewCheckKey'],
  string
> = {
  'identity.email': 'Add a support email',
  'identity.social_links': 'Add social links',
  'identity.stripe_identity_verification': 'Verify your identity',
  product_description: 'Describe what you sell',
  product_url: 'Add your product website',
  payout_account: 'Connect a payout account',
  product_configuration: 'Create your first product',
  setup_readiness: 'Set up checkout',
}

export const STEP_DESCRIPTIONS: Record<
  schemas['OrganizationReviewCheckKey'],
  string
> = {
  'identity.email': 'An email address customers can reach you at',
  'identity.social_links': 'A public profile can speed up review',
  'identity.stripe_identity_verification':
    'Unlocks payouts. Takes ~5 min with a photo ID',
  product_description: 'What you sell, who it’s for, and your pricing',
  product_url: 'The website where customers find your product',
  payout_account: 'Where we send your revenue',
  product_configuration: 'Something for customers to buy',
  setup_readiness: 'A checkout link or API integration so you can get paid',
}

export const STEP_ACTION_LABELS: Partial<
  Record<
    schemas['OrganizationReviewCheckKey'],
    Partial<Record<schemas['OrganizationReviewCheckStatus'], string>>
  >
> = {
  'identity.email': { pending: 'Add' },
  'identity.social_links': { pending: 'Add' },
  'identity.stripe_identity_verification': {
    pending: 'Verify',
    passed: 'View',
  },
  product_description: { pending: 'Write' },
  product_url: { pending: 'Add' },
  payout_account: { pending: 'Connect', passed: 'Manage' },
  product_configuration: { pending: 'Create', passed: 'View' },
  setup_readiness: { pending: 'Set up', passed: 'View' },
}

export const OPTIONAL_STEP_KEYS: ReadonlySet<
  schemas['OrganizationReviewCheckKey']
> = new Set(['identity.social_links'])

export const isRequiredStep = (
  step: schemas['OrganizationReviewCheck'],
): boolean => !OPTIONAL_STEP_KEYS.has(step.key)

export const isIncompleteStep = (
  step: schemas['OrganizationReviewCheck'],
): boolean => step.status === 'failed' || step.status === 'pending'
