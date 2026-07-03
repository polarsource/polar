import {
  Button,
  EmailLink,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
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
      preview={`Action needed: update your payment method for ${product.name}`}
    >
      <Intro headline="We couldn&rsquo;t process your payment">
        We tried to charge your payment method for your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription, but it didn&rsquo;t go through. This can happen for a
        number of reasons, like an expired card or a temporary bank hold.
      </Intro>
      <Text>
        Until the payment goes through, your access to{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        won&rsquo;t be available.
      </Text>
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
