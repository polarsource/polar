import { Hr, Section, Text } from '@react-email/components'
import { schemas } from '../types'

const FooterCustomer = ({
  organization,
  email,
}: {
  organization: schemas['Organization']
  email: string
}) => (
  <>
    <Hr />
    <Section className="text-center text-sm">
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
      <Text className="text-gray-900">
        Merchant of Record services provided to{' '}
        <span className="font-semibold">{organization.name}</span> by{' '}
        <span className="font-semibold">Polar Software Inc</span>
      </Text>
    </Section>
  </>
)

export default FooterCustomer
