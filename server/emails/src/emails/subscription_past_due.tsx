import {
  Button,
  EmailLink,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import InfoBox from '../components/InfoBox'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionPastDue({
  email,
  organization,
  product,
  url,
  payment_url,
}: schemas['SubscriptionPastDueProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Action needed: your ${product.name} payment failed`}
    >
      <Intro headline="Your payment failed">
        We couldn&rsquo;t charge your payment method for your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription. This is usually an expired card or a temporary bank hold.
      </Intro>
      <InfoBox title="Your subscription is on hold" variant="error">
        <Text noMargin>
          Access to{' '}
          <Text as="span" weight="medium">
            {product.name}
          </Text>{' '}
          stays unavailable until the payment goes through.
        </Text>
      </InfoBox>
      {payment_url ? (
        <>
          <Button href={payment_url}>Update payment method</Button>
          <Text>
            You can also{' '}
            <EmailLink href={url}>manage your subscription</EmailLink>.
          </Text>
        </>
      ) : (
        <Button href={url}>Manage subscription</Button>
      )}
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionPastDue.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  payment_url: 'https://invoice.stripe.com/i/acct_123/test',
}

export default SubscriptionPastDue
