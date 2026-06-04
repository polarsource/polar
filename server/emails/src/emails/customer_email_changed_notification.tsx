import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import type { schemas } from '../types'

export function CustomerEmailChangedNotification({
  email,
  organization_name,
  new_email,
}: schemas['CustomerEmailChangedNotificationProps']) {
  return (
    <WrapperPolar preview="Your email address has been changed">
      <Intro>
        The email address for your{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>{' '}
        account has been changed to{' '}
        <Text as="span" weight="bold">
          {new_email}
        </Text>
        .
      </Intro>
      <Text variant="caption">
        If you did not make this change, please contact {organization_name}{' '}
        immediately.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

CustomerEmailChangedNotification.PreviewProps = {
  email: 'old@example.com',
  organization_name: 'Acme Inc.',
  new_email: 'new@example.com',
}

export default CustomerEmailChangedNotification
