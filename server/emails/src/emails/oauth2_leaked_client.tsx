import { Link, Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import InfoBox from '../components/InfoBox'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function OAuth2LeakedClient({
  email,
  token_type,
  notifier,
  url,
  client_name,
}: schemas['OAuth2LeakedClientProps']) {
  return (
    <Wrapper>
      <Preview>
        Important security notice: Your OAuth2{' '}
        {token_type === 'client_secret'
          ? 'Client Secret'
          : 'Client Registration Token'}{' '}
        has been publicly leaked
      </Preview>
      <PolarHeader />
      <Section>
        <Text className="text-xl font-bold text-gray-900">
          Important security notice
        </Text>
        {token_type === 'client_secret' ? (
          <Text>
            We've been notified that your OAuth2 Client Secret has been publicly
            leaked. For your security, we've automatically generated a new one.{' '}
            <span className="font-bold">
              You'll need to update your existing integrations so they continue
              working.
            </span>
          </Text>
        ) : (
          <Text>
            We've been notified that your OAuth2 Client Registration Token has
            been publicly leaked. For your security, we've automatically
            generated a new one.
          </Text>
        )}
        <Text>
          In the coming days, be extra careful about any suspicious activity on
          your account and get in touch with us if you have any doubt.
        </Text>
      </Section>
      <InfoBox title="Leak details" variant="warning">
        <ul className="list-disc space-y-1 pl-6">
          <li>Notifier: {notifier}</li>
          <li>URL: {url}</li>
          <li>OAuth2 Client: {client_name}</li>
        </ul>
        <Text className="mb-0 mt-4 text-sm text-gray-600">
          As a reminder, OAuth2 client secrets are super sensitive values that
          shouldn't be shared publicly on the web or in a code repository. Use
          dedicated features to safely store secrets, like{' '}
          <Link
            href="https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions"
            className="text-blue-600 underline"
          >
            GitHub Actions secrets
          </Link>
          .
        </Text>
      </InfoBox>
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          You can read more about why you received this alert in our{' '}
          <Link
            href="https://polar.sh/docs/documentation/integration-guides/authenticating-with-polar#security"
            className="text-blue-600 underline"
          >
            FAQ
          </Link>
          .
        </Text>
      </Section>
      <Footer email={email} />
    </Wrapper>
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
