import { schemas } from '@polar-sh/client'
import { EmailSection } from './EmailSection'
import { IdentityVerificationSection } from './IdentityVerificationSection'
import { PayoutAccountSection } from './PayoutAccountSection'
import { ProductDescriptionSection } from './ProductDescriptionSection'
import { SocialLinksSection } from './SocialLinksSection'

interface SectionProps {
  organization: schemas['Organization']
}

export type SectionRenderer = (props: SectionProps) => React.ReactNode

export const SECTION_RENDERERS: Partial<
  Record<schemas['OrganizationReviewCheckKey'], SectionRenderer>
> = {
  'identity.email': ({ organization }) => (
    <EmailSection organization={organization} />
  ),
  'identity.social_links': ({ organization }) => (
    <SocialLinksSection organization={organization} />
  ),
  'identity.stripe_identity_verification': () => (
    <IdentityVerificationSection />
  ),
  product_description: ({ organization }) => (
    <ProductDescriptionSection organization={organization} />
  ),
  payout_account: ({ organization }) => (
    <PayoutAccountSection organization={organization} />
  ),
}
