import {
  EmailLink,
  Footer,
  Heading,
  List,
  Text,
  WrapperPolar,
} from '../components/foundation'
import InfoBox from '../components/InfoBox'
import SecurityFaqNote from '../components/SecurityFaqNote'
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
      <Heading>Important security notice</Heading>
      {token_type === 'client_secret' ? (
        <Text>
          We've been notified that your OAuth2 Client Secret has been publicly
          leaked. For your security, we've automatically generated a new one.{' '}
          <Text as="span" weight="bold">
            You'll need to update your existing integrations so they continue
            working.
          </Text>
        </Text>
      ) : (
        <Text>
          We've been notified that your OAuth2 Client Registration Token has
          been publicly leaked. For your security, we've automatically generated
          a new one.
        </Text>
      )}
      <Text>
        In the coming days, be extra careful about any suspicious activity on
        your account and get in touch with us if you have any doubt.
      </Text>
      <InfoBox title="Leak details" variant="info">
        <List>
          <List.Item>Notifier: {notifier}</List.Item>
          <List.Item>URL: {url}</List.Item>
          <List.Item>OAuth2 Client: {client_name}</List.Item>
        </List>
        <Text variant="caption" noMargin>
          As a reminder, OAuth2 client secrets are super sensitive values that
          shouldn't be shared publicly on the web or in a code repository. Use
          dedicated features to safely store secrets, like{' '}
          <EmailLink href="https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions">
            GitHub Actions secrets
          </EmailLink>
          .
        </Text>
      </InfoBox>
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
