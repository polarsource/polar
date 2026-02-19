import { Hr, Preview, Section } from '@react-email/components'
import Benefits from '../components/Benefits'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionConfirmation({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionConfirmationProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>You're now subscribed to {product.name}</Preview>
      <Intro headline={`You're now subscribed to ${product.name}`}>
        Thank you for subscribing to{' '}
        <strong className="font-medium">{product.name}</strong>. Your invoice is
        attached.
      </Intro>
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Section className="my-8 text-center">
        <Button href={url}>Access purchase</Button>
      </Section>
      <Hr />
      <OrderSummary order={order} />
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionConfirmation.PreviewProps = {
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

export default SubscriptionConfirmation
