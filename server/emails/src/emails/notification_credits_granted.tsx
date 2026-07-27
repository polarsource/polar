import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import CreditSummaryTable from '../components/CreditSummaryTable'
import type { schemas } from '../types'

export function NotificationCreditsGranted({
  organization_name,
  formatted_amount,
}: schemas['MaintainerAccountCreditsGrantedNotificationPayload']) {
  return (
    <WrapperPolar
      preview={`${organization_name} has received ${formatted_amount} in fee credits`}
    >
      <Intro>
        Great news!{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>{' '}
        has received{' '}
        <Text as="span" weight="bold">
          {formatted_amount}
        </Text>{' '}
        in fee credits!
      </Intro>
      <Text>
        These credits will be automatically applied to reduce your transaction
        fees on future orders. You can view your credit balance and usage
        history in your organization's finance settings.
      </Text>
      <CreditSummaryTable
        formatted_amount={formatted_amount}
        organization_name={organization_name}
      />
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationCreditsGranted.PreviewProps = {
  organization_name: 'Acme Inc.',
  formatted_amount: '$50.00',
}

export default NotificationCreditsGranted
