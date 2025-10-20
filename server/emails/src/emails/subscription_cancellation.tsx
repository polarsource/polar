import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import { organization, product } from '../preview'
import type { schemas } from '../types'

function BenefitsSection({ benefits }: { benefits: any[] }) {
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
  email,
  organization,
  product,
  subscription,
  url,
}: schemas['SubscriptionCancellationProps']) {
  const endDate = new Date(subscription.ends_at!).toLocaleDateString('en-US', {
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
      <FooterCustomer organization={organization} email={email} />
    </Wrapper>
  )
}

SubscriptionCancellation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionCancellation
