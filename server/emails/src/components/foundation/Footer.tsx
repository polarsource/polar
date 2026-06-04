import { Section } from 'react-email'
import Divider from './Divider'
import { Text } from './Text'

const Footer = ({ email }: { email: string | null }) => (
  <>
    <Divider />
    <Section className="text-center">
      {email && (
        <Text variant="caption" align="center" noMargin>
          This email was sent to{' '}
          {/* eslint-disable-next-line email-ds/no-raw-text-elements -- footer value uses the dark tone, label stays muted */}
          <a
            href={`mailto:${email}`}
            className="font-semibold text-gray-900 no-underline"
          >
            {email}
          </a>
          .
        </Text>
      )}
      <Text variant="detail" weight="semibold" align="center" noMargin={!email}>
        Polar Software Inc
      </Text>
    </Section>
  </>
)

export default Footer
