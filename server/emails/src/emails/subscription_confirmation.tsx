import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'

interface SubscriptionConfirmationProps {
  organization: {
    name: string
    slug: string
  }
  product: {
    name: string
  }
  url: string
}

export function SubscriptionConfirmation({
  organization,
  product,
  url,
}: SubscriptionConfirmationProps) {
  return (
    <Wrapper>
      <Preview>Thank you for your subscription to {product.name}!</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Thank you for your subscription!
        </Heading>
        <BodyText>
          Your subscription to <span className="font-bold">{product.name}</span>{' '}
          is now active.
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Access my purchase</Button>
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

SubscriptionConfirmation.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
  },
  product: {
    name: 'Premium Subscription',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionConfirmation
