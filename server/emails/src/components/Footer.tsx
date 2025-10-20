import { Hr, Section, Text } from '@react-email/components'

const Footer = ({ email }: { email: string | null }) => (
  <>
    <Hr />
    <Section className="text-center text-sm text-gray-900">
      {email && (
        <Text className="mb-2">
          This email was sent to <span className="font-semibold">{email}</span>
        </Text>
      )}
      <Text className="font-semibold">Polar Software Inc</Text>
    </Section>
  </>
)

export default Footer
