import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import OTPCode from '../components/OTPCode'
import type { schemas } from '../types'

export function OrganizationEmailVerification({
  email,
  code,
  code_lifetime_minutes,
  organization_name,
}: schemas['OrganizationEmailVerificationProps']) {
  return (
    <WrapperPolar
      preview={`Your code to confirm the support email of ${organization_name} is ${code}. It is valid for the next ${code_lifetime_minutes.toFixed()} minutes.`}
    >
      <Intro>
        Here is your code to confirm {email} as the support email of{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>{' '}
        on Polar.{' '}
        <Text as="span" weight="bold">
          This code is only valid for the next {code_lifetime_minutes} minutes.
        </Text>
      </Intro>
      <OTPCode code={code} domain="polar.sh" />
      <Text variant="caption">
        If you didn't request this email, you can safely ignore it.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

OrganizationEmailVerification.PreviewProps = {
  email: 'support@acme.com',
  code: 'ABC123',
  code_lifetime_minutes: 30,
  organization_name: 'Acme Inc.',
}

export default OrganizationEmailVerification
