import { Preview, Text } from 'react-email'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import OTPCode from '../components/OTPCode'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function LoginCode({
  email,
  code,
  code_lifetime_minutes,
  domain,
}: schemas['LoginCodeProps']) {
  return (
    <WrapperPolar>
      <Preview>
        Your code to sign in is {code}. It is valid for the next{' '}
        {code_lifetime_minutes.toFixed()} minutes.
      </Preview>
      <Intro>
        Here is your code to sign in to Polar.{' '}
        <span className="font-bold">
          This code is only valid for the next {code_lifetime_minutes} minutes.
        </span>
      </Intro>
      <OTPCode code={code} domain={domain} />
      <Text className="text-gray-500">
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
