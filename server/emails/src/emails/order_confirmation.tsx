import Benefits from '../components/Benefits'
import {
  Button,
  Divider,
  FooterCustomer,
  WrapperOrganization,
} from '../components/layout'
import OrderSummary from '../components/OrderSummary'
import { EmailLink, Intro, Text } from '../components/text'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function OrderConfirmation({
  email,
  organization,
  product,
  order,
  url,
}: schemas['OrderConfirmationProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${order.description} purchase`}
    >
      <Intro headline="Thank you for your purchase!">
        Thank you for purchasing{' '}
        <Text as="span" weight="medium">
          {order.description}
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
      {product && (
        <>
          {product.benefits.length > 0 && (
            <Benefits benefits={product.benefits} />
          )}
          <Button href={url}>Access purchase</Button>
        </>
      )}
      <Divider />
      <OrderSummary order={order} />
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

OrderConfirmation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  order,
  url: 'https://polar.sh/acme-inc/portal/orders/12345',
}

export default OrderConfirmation
