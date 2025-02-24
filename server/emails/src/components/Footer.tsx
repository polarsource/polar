import { Hr, Link, Section, Text } from '@react-email/components'

const Footer = () => (
  <>
    <Hr />
    <Section className="text-center">
      <Text className="font-semibold leading-[24px] text-gray-900">
        Polar Software Inc
        <br />
        <Link href="mailto:support@polar.sh">support@polar.sh</Link>
      </Text>
    </Section>
  </>
)

export default Footer
