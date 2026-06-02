import { Section, Text } from 'react-email'
import Divider from './Divider'

const Footer = ({ email }: { email: string | null }) => (
  <>
    <Divider />
    <Section className="text-center text-sm">
      {email && (
        <Text className="mt-0 mb-4 text-gray-500">
          This email was sent to{' '}
          <a
            href={`mailto:${email}`}
            className="font-semibold"
            style={{
              textDecoration: 'none !important',
              color: 'inherit !important',
            }}
          >
            <span
              style={{
                textDecoration: 'none !important',
                color: 'inherit !important',
              }}
            >
              {email}
            </span>
          </a>
          .
        </Text>
      )}
      <Text className="mt-0 font-semibold text-gray-900">
        Polar Software Inc
      </Text>
    </Section>
  </>
)

export default Footer
