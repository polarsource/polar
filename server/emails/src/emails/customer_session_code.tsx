import { Link, Preview, Section, Text } from '@react-email/components'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
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
      <Preview>Your verification code for {organization.name}</Preview>
      <Intro>
        Here&rsquo;s your code to access your purchases from {organization.name}
        . It&nbsp;expires&nbsp;in&nbsp;{code_lifetime_minutes}&nbsp;minutes.
      </Intro>
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
