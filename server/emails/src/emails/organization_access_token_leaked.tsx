import InfoBox from '../components/InfoBox'
import { Footer, WrapperPolar } from '../components/layout'
import SecurityFaqNote from '../components/SecurityFaqNote'
import { EmailLink, Heading, List, Text } from '../components/text'
import type { schemas } from '../types'

export function OrganizationAccessTokenLeaked({
  email,
  notifier,
  url,
  organization_access_token,
}: schemas['OrganizationAccessTokenLeakedProps']) {
  return (
    <WrapperPolar preview="Important security notice: Your organization access token has been leaked">
      <Heading>Important security notice</Heading>
      <Text>
        We've been notified that one of your organization access token has been
        leaked. For your security, we've automatically revoked this access
        token.{' '}
        <Text as="span" weight="bold">
          You'll need to create a new one and update your existing integrations
          so they continue working.
        </Text>
      </Text>
      <Text>
        In the coming days, be extra careful about any suspicious activity on
        your account and get in touch with us if you have any doubt.
      </Text>
      <InfoBox title="Leak details" variant="info">
        <List>
          <List.Item>Notifier: {notifier}</List.Item>
          <List.Item>URL: {url}</List.Item>
          <List.Item>
            Organization Access Token: {organization_access_token}
          </List.Item>
        </List>
        <Text variant="caption">
          As a reminder, organization access tokens are super sensitive values
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

OrganizationAccessTokenLeaked.PreviewProps = {
  email: 'john@example.com',
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  organization_access_token: 'token_abc123',
}

export default OrganizationAccessTokenLeaked
