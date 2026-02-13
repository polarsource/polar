import { Link, Preview, Section, Text } from '@react-email/components'
import FooterCustomer from '../components/FooterCustomer'
import IntroWithHi from '../components/IntroWithHi'
import OTPCode from '../components/OTPCode'
import WrapperOrganization from '../components/WrapperOrganization'
import { organization } from '../preview'
import type { schemas } from '../types'

export function CustomerSessionCode({
  email,
  organization,
  code,
  code_lifetime_minutes,
  url,
}: schemas['CustomerSessionCodeProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your code to access your {organization.name} purchases</Preview>
      <IntroWithHi>
        Use the code below to access your purchases from {organization.name}.{' '}
        <span className="font-bold">
          This code will expire in {code_lifetime_minutes} minutes.
        </span>
      </IntroWithHi>
      <OTPCode code={code} />
      <Section className="mt-6 border-t border-gray-200 pt-4 pb-4">
        <Text className="m-0 text-xs text-gray-600">
          Enter this code at the following URL:
        </Text>
        <Text className="mt-2 mb-0 text-xs">
          <Link href={url} className="break-all text-blue-600 underline">
            {url}
          </Link>
        </Text>
      </Section>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

CustomerSessionCode.PreviewProps = {
  email: 'john@example.com',
  organization,
  code: 'ABC123',
  code_lifetime_minutes: 30,
  url: 'https://polar.sh/acme-inc/portal/authenticate',
}

export default CustomerSessionCode
