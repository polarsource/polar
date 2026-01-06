import { Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function NotificationCreditsGranted({
  organization_name,
  formatted_amount,
}: schemas['MaintainerAccountCreditsGrantedNotificationPayload']) {
  return (
    <Wrapper>
      <Preview>
        {organization_name} has received {formatted_amount} in fee credits
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        Great news! <strong>{organization_name}</strong> has received{' '}
        <strong>{formatted_amount}</strong> in fee credits!
      </IntroWithHi>
      <BodyText>
        These credits will be automatically applied to reduce your transaction
        fees on future orders. You can view your credit balance and usage
        history in your organization's finance settings.
      </BodyText>
      <Section className="mt-6">
        <table className="w-full rounded-lg border border-gray-200">
          <tbody>
            <tr className="border-b border-gray-200 bg-gray-50">
              <td className="p-4">
                <Text className="m-0 text-sm font-semibold text-gray-900">
                  Credit Amount
                </Text>
              </td>
              <td className="p-4 text-right">
                <Text className="m-0 text-sm font-semibold text-gray-900">
                  {formatted_amount}
                </Text>
              </td>
            </tr>
            <tr>
              <td className="p-4">
                <Text className="m-0 text-sm text-gray-600">Organization</Text>
              </td>
              <td className="p-4 text-right">
                <Text className="m-0 text-sm text-gray-900">
                  {organization_name}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
      <Footer email={null} />
    </Wrapper>
  )
}

NotificationCreditsGranted.PreviewProps = {
  organization_name: 'Acme Inc.',
  amount: 5000,
  formatted_amount: '$50.00',
}

export default NotificationCreditsGranted
