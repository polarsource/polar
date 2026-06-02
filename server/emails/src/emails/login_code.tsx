import { Footer, WrapperPolar } from '../components/layout'
import OTPCode from '../components/OTPCode'
import { Intro, Text } from '../components/text'
import type { schemas } from '../types'

export function LoginCode({
  email,
  code,
  code_lifetime_minutes,
  domain,
}: schemas['LoginCodeProps']) {
  return (
    <WrapperPolar
      preview={`Your code to sign in is ${code}. It is valid for the next ${code_lifetime_minutes.toFixed()} minutes.`}
    >
      <Intro>
        Here is your code to sign in to Polar.{' '}
        <Text as="span" weight="bold">
          This code is only valid for the next {code_lifetime_minutes} minutes.
        </Text>
      </Intro>
      <OTPCode code={code} domain={domain} />
      <Text variant="caption">
        If you didn't request this email, you can safely ignore it.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

LoginCode.PreviewProps = {
  email: 'john@example.com',
  code: 'ABC123',
  code_lifetime_minutes: 30,
  domain: 'polar.sh',
}

export default LoginCode
