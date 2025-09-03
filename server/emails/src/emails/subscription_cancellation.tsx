import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import type { BenefitProps, OrganizationProps, ProductProps } from '../types'

interface SubscriptionCancellationProps {
  organization: OrganizationProps
  product: ProductProps
  subscription: {
    ends_at: string // ISO date string
  }
  url: string
}

function BenefitsSection({ benefits }: { benefits: BenefitProps[] }) {
  // Only render if there are actual benefits to display
  if (benefits.length === 0) {
    return null
  }
  return (
    <>
      <BodyText>
        Meanwhile, you will continue to have access to the following benefits:
      </BodyText>
      <ul className="list-disc space-y-1 pl-6">
        {benefits.map((benefit, index) => (
          <li key={index}>{benefit.description}</li>
        ))}
      </ul>
    </>
  )
}

export function SubscriptionCancellation({
  organization,
  product,
  subscription,
  url,
}: SubscriptionCancellationProps) {
  const endDate = new Date(subscription.ends_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Wrapper>
      <Preview>Your subscription to {product.name} has been canceled</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has been canceled
        </Heading>
        <BodyText>
          We're sorry to see you go! Your subscription to{' '}
          <span className="font-bold">{product.name}</span> will remain active
          until <span className="font-bold">{endDate}</span>, after which it
          will be canceled.
        </BodyText>
        <BodyText>
          If you change your mind, you can renew your subscription anytime
          before the end date.
        </BodyText>
        <BenefitsSection benefits={product.benefits} />
      </Section>
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

SubscriptionCancellation.PreviewProps = {
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
}

export default SubscriptionCancellation
