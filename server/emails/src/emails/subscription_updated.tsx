import { Hr, Preview, Section } from '@react-email/components'
import Benefits from '../components/Benefits'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionUpdated({
  email,
  organization,
  product,
  subscription,
  order,
  url,
  proration_behavior,
}: schemas['SubscriptionUpdatedProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>You&rsquo;re now subscribed to {product.name}</Preview>
      <Intro headline={`You're now subscribed to ${product.name}`}>
        {proration_behavior === 'reset' ? (
          "This change is effective immediately. You've been billed the full amount for the new plan and your billing cycle has been reset to today."
        ) : order ? (
          <>
            This change is effective immediately and you&rsquo;ll be billed at
            your new rate going forward.{' '}
            The invoice for this change is attached.
          </>
        ) : (
          "This change is effective immediately and you'll be billed at your new rate going forward. Any difference in price will be reflected on your next billing cycle."
        )}
      </Intro>
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Section className="my-8 text-center">
        <Button href={url}>View subscription</Button>
      </Section>
      <Hr />

      {order ? <OrderSummary order={order} /> : null}

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionUpdated.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'active',
  },
  order,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUpdated
