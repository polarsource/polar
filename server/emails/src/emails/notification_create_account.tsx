import { Button, Footer, WrapperPolar } from '../components/layout'
import { Intro, Text } from '../components/text'
import type { schemas } from '../types'

export function NotificationCreateAccount({
  organization_name,
  url,
}: schemas['MaintainerCreateAccountNotificationPayload']) {
  return (
    <WrapperPolar preview="Your Polar account is being reviewed">
      <Intro>
        Now that you got your first payment to {organization_name}, you should
        create a payout account in order to receive your funds.
      </Intro>
      <Text>
        This operation only takes a few minutes and allows you to receive your
        money immediately.
      </Text>
      <Button href={url}>Create payout account</Button>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationCreateAccount.PreviewProps = {
  organization_name: 'Acme Inc.',
  url: 'https://polar.sh',
}

export default NotificationCreateAccount
