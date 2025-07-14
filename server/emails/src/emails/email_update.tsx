import { Link, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'

interface EmailUpdateProps {
  token_lifetime_minutes: number
  url: string
  current_year: number
}

export function EmailUpdate({ token_lifetime_minutes, url }: EmailUpdateProps) {
  return (
    <Wrapper>
      <Preview>Here is the verification link to update your email</Preview>
      <PolarHeader />
      <Section>
        <Text>Hi,</Text>
        <Text>
          Here is the verification link to update your email. Click the button
          below to complete the update process.{' '}
          <span className="font-bold">
            This link is only valid for the next {token_lifetime_minutes}{' '}
            minutes.
          </span>
        </Text>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Update my email</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser.
        </Text>
        <Text className="text-sm">
          <Link
            href={url}
            className="text-blue-600 underline dark:text-blue-400"
          >
            {url}
          </Link>
        </Text>
      </Section>
      <Footer />
    </Wrapper>
  )
}

EmailUpdate.PreviewProps = {
  token_lifetime_minutes: 30,
  url: 'https://polar.sh/settings/account/email/update?token=abc123',
  current_year: new Date().getFullYear(),
}

export default EmailUpdate
