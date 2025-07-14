import { Link, Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import Header from '../components/Header'
import OTPCode from '../components/OTPCode'
import Wrapper from '../components/Wrapper'

interface CustomerSessionCodeProps {
  featured_organization: {
    name: string
    slug: string
  }
  code: string
  code_lifetime_minutes: number
  url: string
  current_year: number
}

export function CustomerSessionCode({
  featured_organization,
  code,
  code_lifetime_minutes,
  url,
}: CustomerSessionCodeProps) {
  return (
    <Wrapper>
      <Preview>
        Here is your code to access your {featured_organization.name} purchases
      </Preview>
      <Header featuredOrganization={featured_organization} />
      <Section>
        <Text>Hi,</Text>
        <Text>
          Here is your code to access your {featured_organization.name}{' '}
          purchases. Click the button below to complete the login process.{' '}
          <span className="font-bold">
            This code is only valid for the next {code_lifetime_minutes}{' '}
            minutes.
          </span>
        </Text>
      </Section>
      <OTPCode code={code} />
      <Section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          You should input this code at the following URL
        </Text>
        <Text className="text-sm">
          <Link
            href={url}
            className="text-blue-600 underline dark:text-blue-400"
          >
            {url}
          </Link>
        </Text>
      </Section>
      <Footer />
    </Wrapper>
  )
}

CustomerSessionCode.PreviewProps = {
  featured_organization: {
    name: 'Acme Inc',
    slug: 'acme-inc',
  },
  code: 'ABC123',
  code_lifetime_minutes: 30,
  url: 'https://polar.sh/acme-inc/portal/authenticate',
  current_year: new Date().getFullYear(),
}

export default CustomerSessionCode
