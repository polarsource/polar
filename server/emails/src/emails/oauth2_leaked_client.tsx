import { Link, Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import Header from '../components/Header'
import InfoBox from '../components/InfoBox'
import Wrapper from '../components/Wrapper'

interface OAuth2LeakedClientProps {
  token_type: 'client_secret' | 'client_registration_token'
  notifier: string
  url?: string
  client_name: string
  current_year: number
}

export function OAuth2LeakedClient({
  token_type,
  notifier,
  url,
  client_name,
}: OAuth2LeakedClientProps) {
  return (
    <Wrapper>
      <Preview>
        Important security notice: Your OAuth2{' '}
        {token_type === 'client_secret'
          ? 'Client Secret'
          : 'Client Registration Token'}{' '}
        has been publicly leaked
      </Preview>
      <Header />
      <Section>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
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
          {url && <li>URL: {url}</li>}
          <li>OAuth2 Client: {client_name}</li>
        </ul>
        <Text className="mb-0 mt-4 text-sm text-gray-600 dark:text-gray-400">
          As a reminder, OAuth2 client secrets are super sensitive values that
          shouldn't be shared publicly on the web or in a code repository. Use
          dedicated features to safely store secrets, like{' '}
          <Link
            href="https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions"
            className="text-blue-600 underline dark:text-blue-400"
          >
            GitHub Actions secrets
          </Link>
          .
        </Text>
      </InfoBox>
      <Section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          You can read more about why you received this alert in our{' '}
          <Link
            href="https://docs.polar.sh/documentation/integration-guides/authenticating-with-polar#security"
            className="text-blue-600 underline dark:text-blue-400"
          >
            FAQ
          </Link>
          .
        </Text>
      </Section>
      <Footer />
    </Wrapper>
  )
}

OAuth2LeakedClient.PreviewProps = {
  token_type: 'client_secret' as const,
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  client_name: 'My OAuth2 App',
  current_year: new Date().getFullYear(),
}

export default OAuth2LeakedClient
