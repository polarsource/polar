import Text from '../components/text/Text'
import Benefits from '../components/Benefits'
import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import Divider from '../components/layout/Divider'
import EmailLink from '../components/text/EmailLink'
import FooterCustomer from '../components/layout/FooterCustomer'
import Intro from '../components/text/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/layout/WrapperOrganization'
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
      <CTASection>
        <Button href={url}>Access purchase</Button>
      </CTASection>
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
  subscription: {
    id: '12345',
    status: 'active',
  },
  order,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionConfirmation
