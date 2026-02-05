import { Link, Preview, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function NotificationCreateAccount({
  organization_name,
  url,
}: schemas['MaintainerCreateAccountNotificationPayload']) {
  return (
    <WrapperPolar>
      <Preview>Your Polar account is being reviewed</Preview>
      <IntroWithHi>
        Now that you got your first payment to {organization_name}, you should
        create a payout account in order to receive your funds.
      </IntroWithHi>
      <BodyText>
        This operation only takes a few minutes and allows you to receive your
        money immediately.
      </BodyText>
      <Button href={url}>Create my payout account</Button>
      <Text>
        If you're having trouble with the button above, copy and paste the URL
        below into your web browser.
      </Text>
      <Link href={url}>{url}</Link>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationCreateAccount.PreviewProps = {
  organization_name: 'Acme Inc.',
  url: 'https://polar.sh',
}

export default NotificationCreateAccount
