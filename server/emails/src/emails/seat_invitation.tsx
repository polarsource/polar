import { Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
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
    <WrapperOrganization organization={organization}>
      <Preview>
        You&rsquo;ve been invited to access {product_name} from{' '}
        {organization.name}
      </Preview>
      <Intro>
        {billing_manager_email} has invited you to{' '}
        <span className="font-medium">{product_name}</span>. Claim your seat to
        get started.
      </Intro>
      <Text className="text-sm text-gray-600">
        This invitation expires in 24 hours.
      </Text>
      <Section className="text-center">
        <Button href={claim_url}>Claim seat</Button>
      </Section>

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
