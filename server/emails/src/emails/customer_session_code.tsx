import { FooterCustomer, WrapperOrganization } from '../components/layout'
import OTPCode from '../components/OTPCode'
import { EmailLink, Intro, Text } from '../components/text'
import { organization } from '../preview'
import type { schemas } from '../types'

export function CustomerSessionCode({
  email,
  organization,
  code,
  code_lifetime_minutes,
  url,
  domain,
}: schemas['CustomerSessionCodeProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your verification code for ${organization.name}`}
    >
      <Intro>
        You can use the following code to access your purchases on the{' '}
        <EmailLink href={url}>{organization.name} Customer Portal</EmailLink>.
      </Intro>
      <OTPCode code={code} domain={domain} />
      <Text variant="caption" align="center">
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
  domain: 'polar.sh',
}

export default CustomerSessionCode
