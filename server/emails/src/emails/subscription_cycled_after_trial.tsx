import Text from '../components/text/Text'
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

export function SubscriptionCycledAfterTrial({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionCycledAfterTrialProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} trial ended`}
    >
      <Intro headline="Your trial has ended">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        trial is over and your subscription is now active. Your first invoice is
        attached.
        {order.receipt_number && (
          <>
            {' '}
            You can find your receipt in the{' '}
            <EmailLink href={url}>Customer Portal</EmailLink>.
          </>
        )}
      </Intro>
      <CTASection>
        <Button href={url}>Manage subscription</Button>
      </CTASection>
      <Divider />
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
