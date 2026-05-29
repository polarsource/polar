import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import Footer from '../components/layout/Footer'
import Intro from '../components/text/Intro'
import Text from '../components/text/Text'
import WrapperPolar from '../components/layout/WrapperPolar'
import type { schemas } from '../types'

export function OrganizationInvite({
  email,
  organization_name,
  inviter_email,
  invite_url,
}: schemas['OrganizationInviteProps']) {
  return (
    <WrapperPolar
      preview={`You've been added to ${organization_name} on Polar`}
    >
      <Intro>
        {inviter_email} has added you to{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>{' '}
        on Polar.
      </Intro>
      <Text>
        As a member of {organization_name} you're now able to manage{' '}
        {organization_name}'s products, customers, and subscriptions on Polar.
      </Text>
      <CTASection>
        <Button href={invite_url}>Go to the Polar dashboard</Button>
      </CTASection>
      <Footer email={email} />
    </WrapperPolar>
  )
}

OrganizationInvite.PreviewProps = {
  email: 'john@example.com',
  organization_name: 'Acme Inc.',
  inviter_email: 'admin@acme.com',
  invite_url: 'https://polar.sh/dashboard/acme-inc',
}

export default OrganizationInvite
