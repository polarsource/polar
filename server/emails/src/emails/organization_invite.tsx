import { Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function OrganizationInvite({
  organization_name,
  inviter_email,
  invite_url,
}: {
  organization_name: string
  inviter_email: string
  invite_url: string
}) {
  return (
    <Wrapper>
      <Preview>You've been added to {organization_name} on Polar</Preview>
      <PolarHeader />
      <IntroWithHi>
        {inviter_email} has added you to{' '}
        <span className="font-bold">{organization_name}</span> on Polar.
      </IntroWithHi>
      <Section>
        <Text>
          As a member of {organization_name} you're now able to manage{' '}
          {organization_name}'s products, customers, and subscriptions on Polar.
        </Text>
      </Section>
      <Section className="text-center">
        <Button href={invite_url}>Go to the Polar dashboard</Button>
      </Section>
      <Footer />
    </Wrapper>
  )
}

OrganizationInvite.PreviewProps = {
  organization_name: 'Acme Inc.',
  inviter_email: 'admin@acme.com',
  invite_url: 'https://polar.sh/dashboard/acme-inc',
}

export default OrganizationInvite
