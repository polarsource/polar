import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import type { OrganizationProps, ProductProps, PurchaseDetailsProps } from '../types'

interface SubscriptionConfirmationProps {
  organization: OrganizationProps
  product: ProductProps
  purchase_details: PurchaseDetailsProps
  url: string
}

export function SubscriptionConfirmation({
  organization,
  product,
  purchase_details,
  url,
}: SubscriptionConfirmationProps) {
  const intervalDisplay = purchase_details.recurring_interval
    ? ` / ${purchase_details.recurring_interval}`
    : ''

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

      <Section className="my-8 rounded-lg bg-gray-50 p-6">
        <Heading as="h2" className="text-lg font-semibold text-gray-900 mb-4">
          Purchase Details
        </Heading>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Text className="text-gray-700 mb-0">
              {product.name}{intervalDisplay}
            </Text>
            <Text className="font-medium text-gray-900 mb-0">
              {purchase_details.formatted_amount}
            </Text>
          </div>

          {purchase_details.discount && purchase_details.formatted_discount_amount && (
            <div className="flex justify-between items-center">
              <Text className="text-gray-700 mb-0">
                Discount ({purchase_details.discount.name}
                {purchase_details.discount.code && ` - ${purchase_details.discount.code}`})
              </Text>
              <Text className="font-medium text-green-600 mb-0">
                -{purchase_details.formatted_discount_amount}
              </Text>
            </div>
          )}

          <hr className="border-gray-300" />

          <div className="flex justify-between items-center">
            <Text className="font-semibold text-gray-900 mb-0">
              Total{intervalDisplay}
            </Text>
            <Text className="font-bold text-lg text-gray-900 mb-0">
              {purchase_details.formatted_discounted_amount}
            </Text>
          </div>
        </div>
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
    logo_url:
      'https://polar-public-sandbox-files.s3.amazonaws.com/organization_avatar/b3281d01-7b90-4a5b-8225-e8e150f4009c/9e5f848b-8b1d-4592-9fe1-7cad2cfa53ee/unicorn-dev-logo.png',
    website_url: 'https://www.example.com',
  },
  product: {
    name: 'Premium Subscription',
    benefits: [],
  },
  purchase_details: {
    amount: 2000,
    currency: 'usd',
    recurring_interval: 'month',
    discount: {
      name: 'Early Bird Discount',
      code: 'EARLY20',
      type: 'percentage',
      basis_points: 2000,
    },
    discounted_amount: 1600,
    formatted_amount: '$20.00',
    formatted_discounted_amount: '$16.00',
    formatted_discount_amount: '$4.00',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionConfirmation
