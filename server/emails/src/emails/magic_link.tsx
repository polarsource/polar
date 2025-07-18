import { Button, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

export function MagicLink({
  token_lifetime_minutes,
  url,
}: {
  token_lifetime_minutes: number
  url: string
}) {
  return (
    <Wrapper>
      <PolarHeader />
      <IntroWithHi>
        Here is your magic link to sign in to Polar. Click the button below to
        complete the login process.{' '}
        <span className="font-bold">
          This link is only valid for the next {token_lifetime_minutes} minutes
        </span>
      </IntroWithHi>
      <Section className="text-center">
        <Button
          href={url}
          className="bg-brand rounded-full px-6 py-2 text-xl font-medium leading-4 text-white"
        >
          Sign in
        </Button>
      </Section>
      <Text className="text-gray-500">
        If you didn't request this email, you can safely ignore it.
      </Text>
      <Footer />
    </Wrapper>
  )
}

MagicLink.PreviewProps = {
  token_lifetime_minutes: 30,
  url: 'https://example.com',
}

export default MagicLink
