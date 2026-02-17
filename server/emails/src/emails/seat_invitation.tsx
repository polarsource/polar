import { Preview, Section } from '@react-email/components'
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
        You've been invited to access {product_name} by {organization.name}
      </Preview>
      <Intro>
        {billing_manager_email} has invited you to access{' '}
        <span className="font-bold">{product_name}</span> from{' '}
        <span className="font-bold">{organization.name}</span>.
        <br />
        <br />
        A seat has been assigned to you. Click the button below to claim your
        seat and access your benefits.
        <br />
        <br />
        <span className="text-sm text-gray-600">
          This invitation expires in 24 hours.
        </span>
      </Intro>
      <Section className="text-center">
        <Button href={claim_url}>Claim Your Seat</Button>
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
