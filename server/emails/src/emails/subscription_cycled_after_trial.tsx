import { Hr, Preview, Section } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionCycledAfterTrial({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionCycledAfterTrialProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>
        Your {product.name} trial ended — your subscription is now active
      </Preview>
      <Intro headline="Your trial has ended">
        Your <span className="font-bold">{product.name}</span> trial is over and
        your subscription is now active. Here&rsquo;s your first receipt.
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

SubscriptionCycledAfterTrial.PreviewProps = {
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

export default SubscriptionCycledAfterTrial
