import { schemas } from '@polar-sh/client'
import { EmailSection } from './EmailSection'
import { IdentityVerificationSection } from './IdentityVerificationSection'
import { PayoutAccountSection } from './PayoutAccountSection'
import { ProductConfigurationSection } from './ProductConfigurationSection'
import { ProductDescriptionSection } from './ProductDescriptionSection'
import { ProductUrlSection } from './ProductUrlSection'
import { SetupReadinessSection } from './SetupReadinessSection'
import { SocialLinksSection } from './SocialLinksSection'
import { STEP_LABELS } from './stepLabels'

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
    label: STEP_LABELS['identity.email'],
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
    label: STEP_LABELS['identity.social_links'],
    render: ({ organization }) => (
      <SocialLinksSection organization={organization} />
    ),
  },
  'identity.stripe_identity_verification': {
    label: STEP_LABELS['identity.stripe_identity_verification'],
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
    label: STEP_LABELS.product_description,
    render: ({ organization }) => (
      <ProductDescriptionSection organization={organization} />
    ),
  },
  product_url: {
    label: STEP_LABELS.product_url,
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
    label: STEP_LABELS.payout_account,
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
    label: STEP_LABELS.product_configuration,
    render: ({ organization }) => (
      <ProductConfigurationSection organization={organization} />
    ),
  },
  setup_readiness: {
    label: STEP_LABELS.setup_readiness,
    reasonLabels: {
      'setup_readiness.webhook_missing': 'Creating a webhook is recommended',
    },
    render: ({ organization, step }) => (
      <SetupReadinessSection organization={organization} step={step} />
    ),
  },
}
