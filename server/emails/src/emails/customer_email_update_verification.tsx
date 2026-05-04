import { Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function CustomerEmailUpdateVerification({
  email,
  organization_name,
  token_lifetime_minutes,
  url,
}: schemas['CustomerEmailUpdateVerificationProps']) {
  return (
    <WrapperPolar>
      <Preview>Verify your new email address for {organization_name}</Preview>
      <Intro>
        You requested to change your email address for your{' '}
        <span className="font-bold">{organization_name}</span> account. Click
        the button below to verify this email address.{' '}
        <span className="font-bold">
          This link is only valid for the next {token_lifetime_minutes} minutes.
        </span>
      </Intro>

      <Section className="my-8 text-center">
        <Button href={url}>Verify Email Address</Button>
      </Section>

      <Footer email={email} />
    </WrapperPolar>
  )
}

CustomerEmailUpdateVerification.PreviewProps = {
  email: 'new@example.com',
  organization_name: 'Acme Inc.',
  token_lifetime_minutes: 30,
  url: 'https://polar.sh/acme-inc/portal/verify-email?token=polar_cev_abc123',
}

export default CustomerEmailUpdateVerification
