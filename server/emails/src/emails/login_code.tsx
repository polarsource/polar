import { Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function LoginCode({
  email,
  code,
  code_lifetime_minutes,
}: schemas['LoginCodeProps']) {
  return (
    <Wrapper>
      <Preview>
        Your code to sign in is {code}. It is valid for the next{' '}
        {code_lifetime_minutes.toFixed()} minutes.
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        Here is your code to sign in to Polar.{' '}
        <span className="font-bold">
          This code is only valid for the next {code_lifetime_minutes} minutes.
        </span>
      </IntroWithHi>
      <Section className="text-center">
        <Text className="text-brand text-5xl font-bold tracking-wider">
          {code}
        </Text>
      </Section>
      <Text className="text-gray-500">
        If you didn't request this email, you can safely ignore it.
      </Text>
      <Footer email={email} />
    </Wrapper>
  )
}

LoginCode.PreviewProps = {
  email: 'john@example.com',
  code: 'ABC123',
  code_lifetime_minutes: 30,
}

export default LoginCode
