import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'

interface SubscriptionCancellationProps {
  organization: {
    name: string
    slug: string
  }
  product: {
    name: string
    benefits: Array<{
      description: string
    }>
  }
  subscription: {
    ends_at: string // ISO date string
  }
  url: string
  current_year: number
}

function BenefitsSection({ benefits }: { benefits: Array<{ description: string }> }) {
  // Only render if there are actual benefits to display
  if (benefits.length === 0) {
    return null
  }
  return (
    <>
      <BodyText>Meanwhile, you will continue to have access to the following benefits:</BodyText>
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
        <Heading
          as="h1"
          className="text-xl font-bold text-gray-900 dark:text-white"
        >
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
      <Section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser:
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

SubscriptionCancellation.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
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
  current_year: new Date().getFullYear(),
}

export default SubscriptionCancellation
