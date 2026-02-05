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
      <Preview>
        Here is your code to access your {organization.name} purchases
      </Preview>
      <IntroWithHi>
        Here is your code to access your {organization.name}{' '}
        <span className="font-bold">
          This code is only valid for the next {code_lifetime_minutes} minutes.
        </span>
      </IntroWithHi>
      <OTPCode code={code} />
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          You should input this code at the following URL
        </Text>
        <Text className="text-sm">
          <Link href={url} className="text-blue-600 underline">
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
