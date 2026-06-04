import {
  Button,
  Footer,
  Heading,
  Intro,
  List,
  Text,
  WrapperPolar,
} from '../components/foundation'
import InfoBox from '../components/InfoBox'
import type { schemas } from '../types'

export function WebhookEndpointDisabled({
  email,
  organization,
  webhook_endpoint_url,
  dashboard_url,
}: schemas['WebhookEndpointDisabledProps']) {
  return (
    <WrapperPolar
      preview={`Webhook endpoint disabled for ${organization.name} due to continuous failures`}
    >
      <Intro>
        We've automatically disabled a webhook endpoint for{' '}
        <Text as="span" weight="bold">
          {organization.name}
        </Text>{' '}
        due to continuous delivery failures.
      </Intro>
      <Text>
        After multiple consecutive failed delivery attempts, we've disabled your
        webhook endpoint to prevent further issues. This typically happens when
        the endpoint URL is unreachable or returns errors.
      </Text>
      <InfoBox title="Disabled Endpoint" variant="warning">
        <Text variant="mono" noMargin>
          {webhook_endpoint_url}
        </Text>
      </InfoBox>
      <Heading>What to do next</Heading>
      <Text>
        To resume receiving webhooks, please verify that your endpoint is
        working correctly and then re-enable it manually from the dashboard.
      </Text>
      <List>
        <List.Item>Check that your endpoint URL is accessible</List.Item>
        <List.Item>
          Ensure your server is responding with 2xx status codes
        </List.Item>
        <List.Item>Review your server logs for any errors</List.Item>
        <List.Item>Re-enable the webhook from your dashboard</List.Item>
      </List>
      <Button href={dashboard_url}>Manage webhooks</Button>
      <Footer email={email} />
    </WrapperPolar>
  )
}

WebhookEndpointDisabled.PreviewProps = {
  email: 'admin@example.com',
  organization: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Acme Inc.',
    slug: 'acme-inc',
    avatar_url: 'https://avatars.githubusercontent.com/u/105373340?s=200&v=4',
  },
  webhook_endpoint_url: 'https://api.example.com/webhooks/polar',
  dashboard_url: 'https://polar.sh/dashboard/acme-inc/settings/webhooks',
}

export default WebhookEndpointDisabled
