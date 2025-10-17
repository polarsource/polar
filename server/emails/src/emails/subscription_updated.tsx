import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function SubscriptionUpdated({
  proration_behavior,
  organization,
  product,
  subscription,
  previous_product,
  url,
}: schemas['SubscriptionUpdatedProps']) {
  return (
    <Wrapper>
      <Preview>Your subscription has been updated to {product.name}</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has been updated
        </Heading>
        <BodyText>
          Your subscription has been successfully changed from{' '}
          <span className="font-medium">{previous_product.name}</span> to{' '}
          <span className="font-bold">{product.name}</span>.
        </BodyText>
        {product.benefits && product.benefits.length > 0 && (
          <>
            <BodyText>Your subscription now includes:</BodyText>
            <ul className="mt-2 list-disc pl-6">
              {product.benefits.map((benefit, index) => (
                <li key={index} className="mb-1 text-gray-700">
                  {benefit.description}
                </li>
              ))}
            </ul>
          </>
        )}
        <BodyText>
          The changes take effect immediately. Your new billing amount will be
          reflected in your next billing cycle
          {proration_behavior == 'create_prorations'
            ? ' as well as the pro-rata changes within this cycle.'
            : '. If needed, your card will be charged the pro-rata amount for the change at this time.'}
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>View my subscription</Button>
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

SubscriptionUpdated.PreviewProps = {
  proration_behavior: 'create_prorations',
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
    logo_url:
      'https://polar-public-sandbox-files.s3.amazonaws.com/organization_avatar/b3281d01-7b90-4a5b-8225-e8e150f4009c/9e5f848b-8b1d-4592-9fe1-7cad2cfa53ee/unicorn-dev-logo.png',
    website_url: 'https://www.example.com',
  },
  product: {
    name: 'Basic Plan',
    benefits: [
      { description: 'Up to 3 projects' },
      { description: 'Community support' },
      { description: 'Basic analytics' },
    ],
  },
  previous_product: {
    name: 'Pro Plan',
    benefits: [],
  },
  subscription: {
    id: '12345',
    status: 'active',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUpdated
