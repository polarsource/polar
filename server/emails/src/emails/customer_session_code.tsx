import { Link, Preview, Text } from '@react-email/components'
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
        You can use the following code to access your purchases on the{' '}
        <Link href={url} className="text-blue-500 underline">
          {organization.name} Customer Portal
        </Link>
        .
      </Intro>

      <OTPCode code={code} />

      <Text className="mt-2 text-center text-sm text-gray-500">
        This&nbsp;code&nbsp;expires&nbsp;in&nbsp;
        {code_lifetime_minutes}
        &nbsp;minutes.
      </Text>

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
