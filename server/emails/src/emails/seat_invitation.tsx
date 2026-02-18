import { Preview, Text } from '@react-email/components'
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
        You&rsquo;re invited to {product_name} from {organization.name}
      </Preview>

      <Intro headline={`You're invited to join ${product_name}`}>
        {billing_manager_email} has invited you to{' '}
        <span className="font-medium">{product_name}</span>.
        Claim&nbsp;your&nbsp;seat&nbsp;to&nbsp;get&nbsp;started.
      </Intro>

      <Button href={claim_url}>Claim seat</Button>

      <Text className="my-8 text-center text-sm text-gray-500">
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
