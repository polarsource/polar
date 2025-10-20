import { Link, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import IntroWithHi from '../components/IntroWithHi'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
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
    <Wrapper>
      <Preview>
        You've been invited to access {product_name} by {organization.name}
      </Preview>
      <OrganizationHeader organization={organization} />
      <IntroWithHi>
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
      </IntroWithHi>
      <Section className="text-center">
        <Button href={claim_url}>Claim Your Seat</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          You can also claim your seat at the following URL
        </Text>
        <Text className="text-sm">
          <Link href={claim_url} className="text-blue-600 underline">
            {claim_url}
          </Link>
        </Text>
      </Section>
      <FooterCustomer organization={organization} email={email} />
    </Wrapper>
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
