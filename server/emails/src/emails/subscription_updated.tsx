import { Hr, Preview, Section } from '@react-email/components'
import Benefits from '../components/Benefits'
import BodyText from '../components/BodyText'
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
}: schemas['SubscriptionUpdatedProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your subscription has been updated to {product.name}</Preview>
      <Intro headline="Your subscription has been updated">
        Your subscription has been successfully changed to{' '}
        <span className="font-bold">{product.name}</span>.
      </Intro>
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Section className="my-8 text-center">
        <Button href={url}>View my subscription</Button>
      </Section>
      <Hr />
      {order ? (
        <>
          <Section>
            <BodyText>
              The changes take effect immediately. The pro-rated amount has been
              charged to your account as part of this update.
            </BodyText>
          </Section>
          <OrderSummary order={order} />
        </>
      ) : (
        <Section>
          <BodyText>
            The changes take effect immediately. The pro-rated amount will be
            reflected on your next billing cycle.
          </BodyText>
        </Section>
      )}

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
