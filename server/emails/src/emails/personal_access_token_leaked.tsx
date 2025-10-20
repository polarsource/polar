import { Link, Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import InfoBox from '../components/InfoBox'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function PersonalAccessTokenLeaked({
  email,
  notifier,
  url,
  personal_access_token,
}: schemas['PersonalAccessTokenLeakedProps']) {
  return (
    <Wrapper>
      <Preview>
        Important security notice: Your personal access token has been leaked
      </Preview>
      <PolarHeader />
      <Section>
        <Text className="text-xl font-bold text-gray-900">
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
          <li>URL: {url}</li>
          <li>Personal Access Token: {personal_access_token}</li>
        </ul>
        <Text className="mb-0 mt-4 text-sm text-gray-600">
          As a reminder, personal access tokens are super sensitive values that
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

PersonalAccessTokenLeaked.PreviewProps = {
  notifier: 'GitHub',
  url: 'https://github.com/example/repo',
  personal_access_token: 'token_xyz789',
}

export default PersonalAccessTokenLeaked
