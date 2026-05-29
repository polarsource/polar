import { Section, Text } from 'react-email'
import EmailLink from './text/EmailLink'

export function SecurityFaqNote() {
  return (
    <Section className="mt-6 border-t border-gray-200 pt-4 pb-2">
      <Text className="m-0 text-sm text-gray-600">
        You can read more about why you received this alert in our{' '}
        <EmailLink href="https://polar.sh/docs/documentation/integration-guides/authenticating-with-polar#security">
          FAQ
        </EmailLink>
        .
      </Text>
    </Section>
  )
}

export default SecurityFaqNote
