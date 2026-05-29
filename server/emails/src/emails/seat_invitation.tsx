import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import FooterCustomer from '../components/layout/FooterCustomer'
import Intro from '../components/text/Intro'
import Text from '../components/text/Text'
import WrapperOrganization from '../components/layout/WrapperOrganization'
import { organization } from '../preview'
import type { schemas } from '../types'

export function SeatInvitation({
  email,
  organization,
  product_name,
  billing_manager_email,
  claim_url,
}: schemas['SeatInvitationProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`You're invited to ${product_name} from ${organization.name}`}
    >
      <Intro headline={`You're invited to join ${product_name}`}>
        {billing_manager_email} has invited you to{' '}
        <Text as="span" weight="medium">
          {product_name}
        </Text>
        . Claim&nbsp;your&nbsp;seat&nbsp;to&nbsp;get&nbsp;started.
      </Intro>

      <CTASection>
        <Button href={claim_url}>Claim seat</Button>
      </CTASection>

      <Text variant="caption" align="center">
        This invitation expires in 24 hours.
      </Text>

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SeatInvitation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product_name: 'Premium Plan',
  billing_manager_email: 'admin@acme.com',
  claim_url: 'https://polar.sh/acme-inc/portal/seats/claim?token=abc123',
}

export default SeatInvitation
