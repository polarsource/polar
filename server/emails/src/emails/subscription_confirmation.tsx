import {
  Button,
  Divider,
  EmailLink,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import Benefits from '../components/Benefits'
import OrderSummary from '../components/OrderSummary'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionConfirmation({
  email,
  organization,
  product,
  order,
  url,
}: schemas['SubscriptionConfirmationProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`You're now subscribed to ${product.name}`}
    >
      <Intro headline={`You're now subscribed to ${product.name}`}>
        Thank you for subscribing to{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>
        . Your invoice is attached.
        {order.receipt_number && (
          <>
            {' '}
            You can find your receipt in the{' '}
            <EmailLink href={url}>Customer Portal</EmailLink>.
          </>
        )}
      </Intro>
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Button href={url}>Access purchase</Button>
      <Divider />
      <OrderSummary order={order} />
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionConfirmation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  order,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionConfirmation
