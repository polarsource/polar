import { Link, Preview, Section, Text } from '@react-email/components'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import OrganizationHeader from '../components/OrganizationHeader'
import OTPCode from '../components/OTPCode'
import Wrapper from '../components/Wrapper'
import type { OrganizationProps } from '../types'

interface CustomerSessionCodeProps {
  organization: OrganizationProps
  code: string
  code_lifetime_minutes: number
  url: string
}

export function CustomerSessionCode({
  organization,
  code,
  code_lifetime_minutes,
  url,
}: CustomerSessionCodeProps) {
  return (
    <Wrapper>
      <Preview>
        Here is your code to access your {organization.name} purchases
      </Preview>
      <OrganizationHeader organization={organization} />
      <IntroWithHi>
        Here is your code to access your {organization.name} purchases. Click
        the button below to complete the login process.{' '}
        <span className="font-bold">
          This code is only valid for the next {code_lifetime_minutes} minutes.
        </span>
      </IntroWithHi>
      <OTPCode code={code} />
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          You should input this code at the following URL
        </Text>
        <Text className="text-sm">
          <Link href={url} className="text-blue-600 underline">
            {url}
          </Link>
        </Text>
      </Section>
      <Footer />
    </Wrapper>
  )
}

CustomerSessionCode.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
    logo_url:
      'https://polar-public-sandbox-files.s3.amazonaws.com/organization_avatar/b3281d01-7b90-4a5b-8225-e8e150f4009c/9e5f848b-8b1d-4592-9fe1-7cad2cfa53ee/unicorn-dev-logo.png',
    website_url: 'https://www.example.com',
  },
  code: 'ABC123',
  code_lifetime_minutes: 30,
  url: 'https://polar.sh/acme-inc/portal/authenticate',
}

export default CustomerSessionCode
