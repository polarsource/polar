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

export function OAuth2LeakedToken({
  email,
  notifier,
  url,
  client_name,
}: schemas['OAuth2LeakedTokenProps']) {
  return (
    <WrapperPolar preview="Important security notice: Your access or refresh token has been publicly leaked">
      <Heading>Important security notice</Heading>
      <Text>
        We've been notified that one of your access or refresh token has been
        publicly leaked. For your security, we've automatically revoked this
        access token and the associated refresh token.
      </Text>
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
          As a reminder, access and refresh tokens are super sensitive values
          that shouldn't be shared publicly on the web or in a code repository.
          Use dedicated features to safely store secrets, like{' '}
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

OAuth2LeakedToken.PreviewProps = {
  email: 'john@example.com',
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  client_name: 'My OAuth2 App',
}

export default OAuth2LeakedToken
