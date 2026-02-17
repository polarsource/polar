import { Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function NotificationCreateAccount({
  organization_name,
  url,
}: schemas['MaintainerCreateAccountNotificationPayload']) {
  return (
    <WrapperPolar>
      <Preview>Your Polar account is being reviewed</Preview>
      <Intro>
        Now that you got your first payment to {organization_name}, you should
        create a payout account in order to receive your funds.
      </Intro>
      <BodyText>
        This operation only takes a few minutes and allows you to receive your
        money immediately.
      </BodyText>
      <Button href={url}>Create my payout account</Button>
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
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationCreateAccount.PreviewProps = {
  organization_name: 'Acme Inc.',
  url: 'https://polar.sh',
}

export default NotificationCreateAccount
