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
      <Preview>
        You've been invited to join {organization_name} on Polar
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        {inviter_email} has invited you to join{' '}
        <span className="font-bold">{organization_name}</span> on Polar.
      </IntroWithHi>
      <Section>
        <Text>
          As a member of {organization_name}, you'll be able to collaborate on
          projects, manage products, and access organization resources.
        </Text>
      </Section>
      <Section className="text-center">
        <Button href={invite_url}>Accept Invitation</Button>
      </Section>
      <Text className="text-gray-500">
        If you don't want to accept this invitation, you can safely ignore this
        email.
      </Text>
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
