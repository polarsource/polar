import { Link, Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import Header from '../components/Header'
import InfoBox from '../components/InfoBox'
import Wrapper from '../components/Wrapper'

interface PersonalAccessTokenLeakedProps {
  notifier: string
  url?: string
  personal_access_token: string
  current_year: number
}

export function PersonalAccessTokenLeaked({
  notifier,
  url,
  personal_access_token,
}: PersonalAccessTokenLeakedProps) {
  return (
    <Wrapper>
      <Preview>
        Important security notice: Your personal access token has been leaked
      </Preview>
      <Header />
      <Section>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
          Important security notice
        </Text>
        <Text>
          We've been notified that one of your personal access token has been
          leaked. For your security, we've automatically revoked this access
          token.{' '}
          <span className="font-bold">
            You'll need to create a new one and update your existing
            integrations so they continue working.
          </span>
        </Text>
        <Text>
          In the coming days, be extra careful about any suspicious activity on
          your account and get in touch with us if you have any doubt.
        </Text>
      </Section>
      <InfoBox title="Leak details" variant="warning">
        <ul className="list-disc space-y-1 pl-6">
          <li>Notifier: {notifier}</li>
          {url && <li>URL: {url}</li>}
          <li>Personal Access Token: {personal_access_token}</li>
        </ul>
        <Text className="mb-0 mt-4 text-sm text-gray-600 dark:text-gray-400">
          As a reminder, personal access tokens are super sensitive values that
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

PersonalAccessTokenLeaked.PreviewProps = {
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  personal_access_token: 'token_xyz789',
  current_year: new Date().getFullYear(),
}

export default PersonalAccessTokenLeaked
