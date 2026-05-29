import Text from '../components/text/Text'
import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import Footer from '../components/layout/Footer'
import Intro from '../components/text/Intro'
import WrapperPolar from '../components/layout/WrapperPolar'
import type { schemas } from '../types'

export function EmailUpdate({
  email,
  token_lifetime_minutes,
  url,
}: schemas['EmailUpdateProps']) {
  return (
    <WrapperPolar preview="Here is the verification link to update your email">
      <Intro>
        Here is the verification link to update your email. Click the button
        below to complete the update process.{' '}
        <Text as="span" weight="bold">
          This link is only valid for the next {token_lifetime_minutes} minutes.
        </Text>
      </Intro>

      <CTASection>
        <Button href={url}>Update email</Button>
      </CTASection>

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
