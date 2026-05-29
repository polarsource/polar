import Footer from '../components/layout/Footer'
import Intro from '../components/text/Intro'
import LeakDetails from '../components/LeakDetails'
import SecurityFaqNote from '../components/SecurityFaqNote'
import Text from '../components/text/Text'
import WrapperPolar from '../components/layout/WrapperPolar'
import type { schemas } from '../types'

export function OAuth2LeakedClient({
  email,
  token_type,
  notifier,
  url,
  client_name,
}: schemas['OAuth2LeakedClientProps']) {
  return (
    <WrapperPolar
      preview={`Important security notice: Your OAuth2 ${
        token_type === 'client_secret'
          ? 'Client Secret'
          : 'Client Registration Token'
      } has been publicly leaked`}
    >
      <Intro headline="Important security notice">
        {token_type === 'client_secret' ? (
          <>
            We've been notified that your OAuth2 Client Secret has been publicly
            leaked. For your security, we've automatically generated a new one.{' '}
            <Text as="span" weight="bold">
              You'll need to update your existing integrations so they continue
              working.
            </Text>
          </>
        ) : (
          <>
            We've been notified that your OAuth2 Client Registration Token has
            been publicly leaked. For your security, we've automatically
            generated a new one.
          </>
        )}
      </Intro>
      <Text>
        In the coming days, be extra careful about any suspicious activity on
        your account and get in touch with us if you have any doubt.
      </Text>
      <LeakDetails
        secretName="OAuth2 client secrets"
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

OAuth2LeakedClient.PreviewProps = {
  email: 'john@example.com',
  token_type: 'client_secret',
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  client_name: 'My OAuth2 App',
}

export default OAuth2LeakedClient
