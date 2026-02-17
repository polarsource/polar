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
      <Preview>Thank you for your order of {order.description}!</Preview>
      <Intro headline="Thank you for your order!">
        You&rsquo;re all set! Your order of{' '}
        <span className="font-bold">{order.description}</span> has been
        processed.
      </Intro>
      {product && (
        <>
          {product.benefits.length > 0 && (
            <Benefits benefits={product.benefits} />
          )}
          <Section className="my-8 text-center">
            <Button href={url}>Access my purchase</Button>
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
