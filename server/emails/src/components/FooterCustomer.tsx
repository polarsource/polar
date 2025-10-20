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
    <Section className="text-center text-sm text-gray-900">
      <Text className="mb-2">
        This email was sent to <span className="font-semibold">{email}</span>
      </Text>
      <Text>
        Merchant of Record services provided to{' '}
        <span className="font-semibold">{organization.name}</span> by{' '}
        <span className="font-semibold">Polar Software Inc</span>
      </Text>
    </Section>
  </>
)

export default FooterCustomer
