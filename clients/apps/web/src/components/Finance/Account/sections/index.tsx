import { schemas } from '@polar-sh/client'
import { EmailSection } from './EmailSection'
import { IdentityVerificationSection } from './IdentityVerificationSection'
import { PayoutAccountSection } from './PayoutAccountSection'
import { ProductConfigurationSection } from './ProductConfigurationSection'
import { ProductDescriptionSection } from './ProductDescriptionSection'
import { ProductUrlSection } from './ProductUrlSection'
import { SetupReadinessSection } from './SetupReadinessSection'
import { SocialLinksSection } from './SocialLinksSection'

interface SectionProps {
  organization: schemas['Organization']
  step: schemas['OrganizationReviewCheck']
  reasonItems: string[]
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
  in_progress: 'In progress',
  external_pending: 'Awaiting external verification',
}

export const STEP_CONFIG: Partial<
  Record<schemas['OrganizationReviewCheckKey'], StepConfig>
> = {
  'identity.email': {
    label: 'Support email',
    reasonLabels: {
      'identity.personal_email': 'Business email is preferred',
      'identity.domain_mismatch':
        'Email domain does not match your organization website',
    },
    render: ({ organization, step, reasonItems }) => (
      <EmailSection
        organization={organization}
        step={step}
        reasonItems={reasonItems}
      />
    ),
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
    render: ({ organization, step, reasonItems }) => (
      <IdentityVerificationSection
        organization={organization}
        step={step}
        reasonItems={reasonItems}
      />
    ),
  },
  product_description: {
    label: 'Product description',
    render: ({ organization }) => (
      <ProductDescriptionSection organization={organization} />
    ),
  },
  product_url: {
    label: 'Product website',
    reasonLabels: {
      'product_url.unreachable': 'We could not reach this URL',
    },
    render: ({ organization, step, reasonItems }) => (
      <ProductUrlSection
        organization={organization}
        step={step}
        reasonItems={reasonItems}
      />
    ),
  },
  payout_account: {
    label: 'Payout account',
    reasonLabels: {
      'payout_account.requirements_due': 'Additional information required',
      'payout_account.payouts_disabled': 'Payouts are currently disabled',
    },
    render: ({ organization, step, reasonItems }) => (
      <PayoutAccountSection
        organization={organization}
        step={step}
        reasonItems={reasonItems}
      />
    ),
  },
  product_configuration: {
    label: 'Product configuration',
    render: ({ organization }) => (
      <ProductConfigurationSection organization={organization} />
    ),
  },
  setup_readiness: {
    label: 'Checkout integration',
    reasonLabels: {
      'setup_readiness.webhook_missing': 'Creating a webhook is recommended',
      'setup_readiness.checkout_link_not_fulfillable': 'Invalid checkout link',
    },
    render: ({ organization, step }) => (
      <SetupReadinessSection organization={organization} step={step} />
    ),
  },
}
