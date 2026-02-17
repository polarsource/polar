import { Link, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function EmailUpdate({
  email,
  token_lifetime_minutes,
  url,
}: schemas['EmailUpdateProps']) {
  return (
    <WrapperPolar>
      <Preview>Here is the verification link to update your email</Preview>
      <Intro>
        Here is the verification link to update your email. Click the button
        below to complete the update process.{' '}
        <span className="font-bold">
          This link is only valid for the next {token_lifetime_minutes} minutes.
        </span>
      </Intro>
      <Section className="my-8 text-center">
        <Button href={url}>Update my email</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-4 pb-4">
        <Text className="m-0 text-xs text-gray-600">
          If you're having trouble with the button above, copy & paste the URL
          below into your web browser.
        </Text>
        <Text className="mt-2 mb-0 text-xs">
          <Link href={url} className="break-all text-blue-600 underline">
            {url}
          </Link>
        </Text>
      </Section>
      <Footer email={email} />
    </WrapperPolar>
  )
}

EmailUpdate.PreviewProps = {
  email: 'john@example.com',
  token_lifetime_minutes: 30,
  url: 'https://polar.sh/settings/account/email/update?token=abc123',
}

export default EmailUpdate
