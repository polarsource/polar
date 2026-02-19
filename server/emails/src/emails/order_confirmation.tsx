import { Hr, Preview, Section } from '@react-email/components'
import Benefits from '../components/Benefits'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import { Intro } from '../components/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
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
    <WrapperOrganization organization={organization}>
      <Preview>Your {order.description} purchase</Preview>
      <Intro headline="Thank you for your purchase!">
        Thank you for purchasing{' '}
        <span className="font-medium">{order.description}</span>. Your invoice
        is attached.
      </Intro>
      {product && (
        <>
          {product.benefits.length > 0 && (
            <Benefits benefits={product.benefits} />
          )}
          <Section className="my-8 text-center">
            <Button href={url}>Access purchase</Button>
          </Section>
        </>
      )}
      <Hr />
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
