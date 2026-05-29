import Footer from '../components/layout/Footer'
import Intro from '../components/text/Intro'
import LeakDetails from '../components/LeakDetails'
import SecurityFaqNote from '../components/SecurityFaqNote'
import Text from '../components/text/Text'
import WrapperPolar from '../components/layout/WrapperPolar'
import type { schemas } from '../types'

export function OAuth2LeakedToken({
  email,
  notifier,
  url,
  client_name,
}: schemas['OAuth2LeakedTokenProps']) {
  return (
    <WrapperPolar preview="Important security notice: Your access or refresh token has been publicly leaked">
      <Intro headline="Important security notice">
        We've been notified that one of your access or refresh token has been
        publicly leaked. For your security, we've automatically revoked this
        access token and the associated refresh token.
      </Intro>
      <Text>
        In the coming days, be extra careful about any suspicious activity on
        your account and get in touch with us if you have any doubt.
      </Text>
      <LeakDetails
        secretName="access and refresh tokens"
        rows={[
          { label: 'Notifier', value: notifier },
          { label: 'URL', value: url },
          { label: 'OAuth2 Client', value: client_name },
        ]}
      />
      <SecurityFaqNote />
      <Footer email={email} />
    </WrapperPolar>
  )
}

OAuth2LeakedToken.PreviewProps = {
  email: 'john@example.com',
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  client_name: 'My OAuth2 App',
}

export default OAuth2LeakedToken
