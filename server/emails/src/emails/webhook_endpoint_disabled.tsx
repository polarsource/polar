import { Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import InfoBox from '../components/InfoBox'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function WebhookEndpointDisabled({
  email,
  organization,
  webhook_endpoint_url,
  dashboard_url,
}: schemas['WebhookEndpointDisabledProps']) {
  return (
    <Wrapper>
      <Preview>
        Webhook endpoint disabled for {organization.name} due to continuous
        failures
      </Preview>
      <PolarHeader />
      <IntroWithHi>
        We've automatically disabled a webhook endpoint for{' '}
        <span className="font-bold">{organization.name}</span> due to continuous
        delivery failures.
      </IntroWithHi>
      <Section>
        <Text>
          After multiple consecutive failed delivery attempts, we've disabled
          your webhook endpoint to prevent further issues. This typically
          happens when the endpoint URL is unreachable or returns errors.
        </Text>
      </Section>
      <InfoBox title="Disabled Endpoint" variant="warning">
        <Text className="mb-0 font-mono text-sm">{webhook_endpoint_url}</Text>
      </InfoBox>
      <Section>
        <Text className="text-xl font-bold text-gray-900">What to do next</Text>
        <Text>
          To resume receiving webhooks, please verify that your endpoint is
          working correctly and then re-enable it manually from the dashboard.
        </Text>
        <ul className="list-disc space-y-1 pl-6">
          <li>Check that your endpoint URL is accessible</li>
          <li>Ensure your server is responding with 2xx status codes</li>
          <li>Review your server logs for any errors</li>
          <li>Re-enable the webhook from your dashboard</li>
        </ul>
      </Section>
      <Section className="text-center">
        <Button href={dashboard_url}>Go to Webhooks Dashboard</Button>
      </Section>
      <Footer email={email} />
    </Wrapper>
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
  dashboard_url:
    'https://polar.sh/dashboard/acme-inc/settings/webhooks',
}

export default WebhookEndpointDisabled
