import { schemas } from '@polar-sh/client'
import { EmailSection } from './EmailSection'
import { IdentityVerificationSection } from './IdentityVerificationSection'
import { PayoutAccountSection } from './PayoutAccountSection'
import { ProductDescriptionSection } from './ProductDescriptionSection'
import { SocialLinksSection } from './SocialLinksSection'

interface SectionProps {
  organization: schemas['Organization']
}

interface StepConfig {
  label: string
  reasonLabels?: Partial<
    Record<schemas['OrganizationReviewCheckReason'], string>
  >
  render: (props: SectionProps) => React.ReactNode
}

export const COMMON_REASON_LABELS: Partial<
  Record<schemas['OrganizationReviewCheckReason'], string>
> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  external_pending: 'Awaiting external verification',
}

export const STEP_CONFIG: Partial<
  Record<schemas['OrganizationReviewCheckKey'], StepConfig>
> = {
  'identity.email': {
    label: 'Support email',
    reasonLabels: {
      'identity.personal_email': 'Please use a business email',
      'identity.domain_mismatch':
        'Email domain does not match your organization website',
    },
    render: ({ organization }) => <EmailSection organization={organization} />,
  },
  'identity.social_links': {
    label: 'Social links',
    render: ({ organization }) => (
      <SocialLinksSection organization={organization} />
    ),
  },
  'identity.stripe_identity_verification': {
    label: 'Identity verification',
    reasonLabels: {
      'identity.rejected': 'Identity verification was rejected',
    },
    render: () => <IdentityVerificationSection />,
  },
  product_description: {
    label: 'Product description',
    render: ({ organization }) => (
      <ProductDescriptionSection organization={organization} />
    ),
  },
  payout_account: {
    label: 'Setup a payout account',
    reasonLabels: {
      'payout_account.requirements_due': 'Additional information required',
      'payout_account.payouts_disabled': 'Payouts are currently disabled',
    },
    render: ({ organization }) => (
      <PayoutAccountSection organization={organization} />
    ),
  },
}
