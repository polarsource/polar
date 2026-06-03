import { Link, Section, Text } from 'react-email'

const SecurityFaqNote = () => (
  <Section className="mt-6 border-t border-gray-200 pt-4 pb-2">
    <Text className="m-0 text-sm text-gray-600">
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
)

export default SecurityFaqNote
