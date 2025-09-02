import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'

interface SubscriptionCycledProps {
  organization: {
    name: string
    slug: string
  }
  product: {
    name: string
  }
  url: string
}

export function SubscriptionCycled({
  organization,
  product,
  url,
}: SubscriptionCycledProps) {
  return (
    <Wrapper>
      <Preview>Your subscription to {product.name} has been renewed</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has been renewed
        </Heading>
        <BodyText>
          Your subscription to <span className="font-bold">{product.name}</span>{' '}
          has been renewed.
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Manage my subscription</Button>
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

SubscriptionCycled.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
    proration_behavior: 'create_prorations',
  },
  product: {
    name: 'Basic Plan',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionCycled
