import { Preview, Text } from 'react-email'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function CustomerEmailChangedNotification({
  email,
  organization_name,
  new_email,
}: schemas['CustomerEmailChangedNotificationProps']) {
  return (
    <WrapperPolar>
      <Preview>Your email address has been changed</Preview>
      <Intro>
        The email address for your{' '}
        <span className="font-bold">{organization_name}</span> account has been
        changed to <span className="font-bold">{new_email}</span>.
      </Intro>

      <Text className="my-4 text-sm text-gray-500">
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
