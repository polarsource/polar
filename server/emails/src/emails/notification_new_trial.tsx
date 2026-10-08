import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import { formatDate } from '../utils/formatters'
import type { schemas } from '../types'

export function NotificationNewTrial({
  subscriber_name,
  subscriber_email,
  product_name,
  trial_end,
}: schemas['MaintainerNewTrialNotificationPayload']) {
  const formattedName = subscriber_email ? (
    <>
      <Text as="span" weight="bold">
        {subscriber_name}
      </Text>{' '}
      ({subscriber_email})
    </>
  ) : (
    <Text as="span" weight="bold">
      {subscriber_name}
    </Text>
  )

  const formattedTrialEnd = trial_end ? formatDate(trial_end) : null

  return (
    <WrapperPolar
      preview={`${subscriber_name} started a ${product_name} trial`}
    >
      <Intro headline="New trial started">
        {formattedName} started a trial of{' '}
        <Text as="span" weight="bold">
          {product_name}
        </Text>
        {formattedTrialEnd ? `, which ends on ${formattedTrialEnd}.` : '.'}
      </Intro>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationNewTrial.PreviewProps = {
  subscriber_name: 'John Doe',
  subscriber_email: 'john.doe@acme.com',
  product_name: 'Pro',
  organization_name: 'Acme Inc.',
  organization_slug: 'acme-inc',
  subscription_id: null,
  trial_end: '2026-10-12T00:00:00Z',
}

export default NotificationNewTrial
