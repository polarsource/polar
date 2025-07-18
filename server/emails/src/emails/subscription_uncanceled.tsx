import { Link, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'

interface SubscriptionUncanceledProps {
  organization: {
    name: string
    slug: string
  }
  product: {
    name: string
  }
  url: string
  current_year: number
}

export function SubscriptionUncanceled({
  organization,
  product,
  url,
}: SubscriptionUncanceledProps) {
  return (
    <Wrapper>
      <Preview>Your subscription to {product.name} is now uncanceled</Preview>
      <OrganizationHeader organization={organization} />
      <Section>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">
          Your subscription is now uncanceled
        </Text>
        <Text>
          Your subscription to <span className="font-bold">{product.name}</span>{' '}
          is no longer canceled.
        </Text>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Manage my subscription</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser.
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

SubscriptionUncanceled.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
  },
  product: {
    name: 'Premium Subscription',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  current_year: new Date().getFullYear(),
}

export default SubscriptionUncanceled
