import {
  Button,
  EmailLink,
  Footer,
  Heading,
  List,
  Text,
  WrapperPolar,
} from '../components/foundation'
import InfoBox from '../components/InfoBox'
import type { schemas } from '../types'

export function DomainVerificationLost({
  domain,
  organization_name,
  settings_url,
  record_name,
  record_value,
}: schemas['DomainVerificationLostProps']) {
  return (
    <WrapperPolar preview={`${domain} is no longer verified`}>
      <Heading>Domain no longer verified</Heading>
      <Text>
        Polar could not find the DNS TXT record that verifies a domain of{' '}
        <Text as="span" weight="bold">
          {organization_name}
        </Text>
        . The domain is no longer verified.
      </Text>
      <Text weight="bold">To verify {domain} again</Text>
      <List>
        <List.Item>
          Open your <EmailLink href={settings_url}>domain settings</EmailLink>.
        </List.Item>
        <List.Item>Add this TXT record to your DNS.</List.Item>
        <List.Item>
          Click Verify next to {domain} once the record is live.
        </List.Item>
      </List>
      <InfoBox title="TXT record" variant="info">
        <Text noMargin>Name: {record_name}</Text>
        <Text noMargin>Value: {record_value}</Text>
      </InfoBox>
      <Text>
        Until then, members signing in with an email on this domain are no
        longer sent straight to SSO.
      </Text>
      <Button href={settings_url}>Open domain settings</Button>
      <Footer email={null} />
    </WrapperPolar>
  )
}

DomainVerificationLost.PreviewProps = {
  email: 'admin@acme.com',
  domain: 'acme.com',
  organization_name: 'Acme Inc.',
  settings_url: 'https://polar.sh/dashboard/acme-inc/settings#domains',
  record_name: '_polar-challenge.acme.com',
  record_value: 'Xy3kP9vQ2mLr8TnW4sJd7FbH1cGz6RaE5uYo0iKe-Nw',
}

export default DomainVerificationLost
