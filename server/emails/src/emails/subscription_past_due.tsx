import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import type { OrganizationProps, ProductProps } from '../types'

interface SubscriptionPastDueProps {
  organization: OrganizationProps
  product: ProductProps
  subscription: {
    ends_at: string // ISO date string
  }
  url: string
  payment_url?: string
}

export function SubscriptionPastDue({
  organization,
  product,
  url,
  payment_url,
}: SubscriptionPastDueProps) {
  return (
    <Wrapper>
      <Preview>Your {product.name} subscription payment is past due</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription payment is past due
        </Heading>
        <BodyText>
          We were unable to process your payment for your{' '}
          <span className="font-bold">{product.name}</span> subscription. Your
          subscription is now past due and access to benefits has been
          temporarily suspended.
        </BodyText>
        <BodyText>
          To restore access to your subscription benefits, please update your
          payment method and complete the payment.
        </BodyText>
      </Section>
      {payment_url && (
        <Section className="my-8 text-center">
          <Button href={payment_url}>Complete Payment</Button>
        </Section>
      )}
      <Section className="my-8 text-center">
        <Button href={url}>Manage my subscription</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser:
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

SubscriptionPastDue.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
    logo_url:
      'https://polar-public-sandbox-files.s3.amazonaws.com/organization_avatar/b3281d01-7b90-4a5b-8225-e8e150f4009c/9e5f848b-8b1d-4592-9fe1-7cad2cfa53ee/unicorn-dev-logo.png',
    website_url: 'https://www.example.com',
  },
  product: {
    name: 'Premium Subscription',
    benefits: [
      { description: 'Access to premium features' },
      { description: 'Priority customer support' },
      { description: 'Advanced analytics' },
    ],
  },
  subscription: {
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  payment_url: 'https://invoice.stripe.com/i/acct_123/test',
}

export default SubscriptionPastDue
