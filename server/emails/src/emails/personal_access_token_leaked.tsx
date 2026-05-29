import Footer from '../components/layout/Footer'
import Intro from '../components/text/Intro'
import LeakDetails from '../components/LeakDetails'
import SecurityFaqNote from '../components/SecurityFaqNote'
import Text from '../components/text/Text'
import WrapperPolar from '../components/layout/WrapperPolar'
import type { schemas } from '../types'

export function PersonalAccessTokenLeaked({
  email,
  notifier,
  url,
  personal_access_token,
}: schemas['PersonalAccessTokenLeakedProps']) {
  return (
    <WrapperPolar preview="Important security notice: Your personal access token has been leaked">
      <Intro headline="Important security notice">
        We've been notified that one of your personal access token has been
        leaked. For your security, we've automatically revoked this access
        token.{' '}
        <Text as="span" weight="bold">
          You'll need to create a new one and update your existing integrations
          so they continue working.
        </Text>
      </Intro>
      <Text>
        In the coming days, be extra careful about any suspicious activity on
        your account and get in touch with us if you have any doubt.
      </Text>
      <LeakDetails
        secretName="personal access tokens"
        rows={[
          { label: 'Notifier', value: notifier },
          { label: 'URL', value: url },
          { label: 'Personal Access Token', value: personal_access_token },
        ]}
      />
      <SecurityFaqNote />
      <Footer email={email} />
    </WrapperPolar>
  )
}

PersonalAccessTokenLeaked.PreviewProps = {
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  personal_access_token: 'token_xyz789',
}

export default PersonalAccessTokenLeaked
