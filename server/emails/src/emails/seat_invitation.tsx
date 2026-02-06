import { Link, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import IntroWithHi from '../components/IntroWithHi'
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
      <Section className="mt-6 border-t border-gray-200 pt-4 pb-4">
        <Text className="m-0 text-xs text-gray-600">
          If you're having trouble with the button above, copy & paste the URL
          below into your web browser.
        </Text>
        <Text className="mt-2 mb-0 text-xs">
          <Link href={claim_url} className="break-all text-blue-600 underline">
            {claim_url}
          </Link>
        </Text>
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
