import { Hr, Preview, Section } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionCycled({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionCycledProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your {product.name} subscription renewed</Preview>
      <Intro headline="Your subscription renewed">
        Your <span className="font-medium">{product.name}</span> subscription
        has just renewed. Your invoice is attached.
      </Intro>
      <Section className="my-8 text-center">
        <Button href={url}>Manage subscription</Button>
      </Section>
      <Hr />
      <OrderSummary order={order} />

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionCycled.PreviewProps = {
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

export default SubscriptionCycled
