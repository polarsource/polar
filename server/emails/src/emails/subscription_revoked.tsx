import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import type { OrganizationProps, ProductProps } from '../types'

interface SubscriptionRevokedProps {
  organization: OrganizationProps
  product: ProductProps
  url: string
}

export function SubscriptionRevoked({
  organization,
  product,
  url,
}: SubscriptionRevokedProps) {
  return (
    <Wrapper>
      <Preview>Your subscription to {product.name} has now ended</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has now ended
        </Heading>
        <BodyText>
          Thank you being a subscriber of{' '}
          <span className="font-bold">{product.name}</span>.
        </BodyText>
        <BodyText>
          We hope to see you again in the future - you're always welcome back.
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>View subscription</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser.
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

SubscriptionRevoked.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
    logo_url:
      'https://polar-public-sandbox-files.s3.amazonaws.com/organization_avatar/b3281d01-7b90-4a5b-8225-e8e150f4009c/9e5f848b-8b1d-4592-9fe1-7cad2cfa53ee/unicorn-dev-logo.png',
    website_url: 'https://www.example.com',
  },
  product: {
    name: 'Premium Subscription',
    benefits: [],
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionRevoked
