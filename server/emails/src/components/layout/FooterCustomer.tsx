import { Section, Text } from 'react-email'
import { schemas } from '../../types'
import Divider from './Divider'

const FooterCustomer = ({
  organization,
  email,
}: {
  organization: schemas['Organization']
  email: string
}) => (
  <>
    <Divider />
    <Section className="text-center">
      <Text className="mt-0 mb-4 text-xs text-gray-400">
        This email was sent to{' '}
        <span className="text-gray-500">
          <a
            href={`mailto:${email}`}
            className="font-medium text-gray-500"
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
        </span>
        .
      </Text>
      <Text className="mt-0 text-xs text-gray-400">
        Merchant of Record services provided to{' '}
        <span className="font-medium text-gray-500">{organization.name}</span>{' '}
        by{' '}
        <span className="font-medium text-gray-500">Polar Software, Inc.</span>
      </Text>
    </Section>
  </>
)

export default FooterCustomer
