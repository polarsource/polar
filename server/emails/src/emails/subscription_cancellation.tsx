import { Heading, Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import WrapperOrganization from '../components/WrapperOrganization'
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
    <WrapperOrganization organization={organization}>
      <Preview>Your subscription to {product.name} has been canceled</Preview>
      <Section>
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

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
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
