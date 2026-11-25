import { Link, Section } from 'react-email'
import { Text } from './foundation'

const SecurityFaqNote = () => (
  <Section>
    <Text variant="caption" noMargin>
      You can read more about why you received this alert in our{' '}
      <Link
        href="https://polar.sh/docs/integrate/authentication#leaked-tokens"
        className="text-blue-600 underline"
      >
        FAQ
      </Link>
      .
    </Text>
  </Section>
)

export default SecurityFaqNote
