import { Section, Text } from '@react-email/components'

interface HeaderProps {
  organization: {
    name: string
    slug: string
  }
}

const Header = ({ organization }: HeaderProps) => (
  <Section className="pt-[10px]">
    <Text className="my-0 text-lg font-bold text-gray-900">
      {organization.name}
    </Text>
  </Section>
)

export default Header
