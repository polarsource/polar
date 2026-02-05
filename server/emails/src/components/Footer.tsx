import { Hr, Section, Text } from '@react-email/components'

const Footer = ({ email }: { email: string | null }) => (
  <>
    <Hr />
    <Section className="text-center text-sm">
      {email && (
        <Text className="mb-2 text-gray-500">
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
      <Text className="font-semibold text-gray-900">Polar Software Inc</Text>
    </Section>
  </>
)

export default Footer
