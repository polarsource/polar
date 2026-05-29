import Text from '../components/text/Text'
import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import Footer from '../components/layout/Footer'
import Intro from '../components/text/Intro'
import WrapperPolar from '../components/layout/WrapperPolar'
import type { schemas } from '../types'

export function CustomerEmailUpdateVerification({
  email,
  organization_name,
  token_lifetime_minutes,
  url,
}: schemas['CustomerEmailUpdateVerificationProps']) {
  return (
    <WrapperPolar
      preview={`Verify your new email address for ${organization_name}`}
    >
      <Intro>
        You requested to change your email address for your{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>{' '}
        account. Click the button below to verify this email address.{' '}
        <Text as="span" weight="bold">
          This link is only valid for the next {token_lifetime_minutes} minutes.
        </Text>
      </Intro>

      <CTASection>
        <Button href={url}>Verify Email Address</Button>
      </CTASection>

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
