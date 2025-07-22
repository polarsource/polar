import { Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function LoginCode({
  code,
  code_lifetime_minutes,
}: {
  code: string
  code_lifetime_minutes: number
}) {
  return (
    <Wrapper>
      <Preview>
        Your code to sign in is {code}. It is valid for the next{' '}
        {code_lifetime_minutes} minutes.
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
      <Footer />
    </Wrapper>
  )
}

LoginCode.PreviewProps = {
  code: 'ABC123',
  code_lifetime_minutes: 30,
}

export default LoginCode
