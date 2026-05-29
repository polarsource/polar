import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import EmailLink from '../components/text/EmailLink'
import FooterCustomer from '../components/layout/FooterCustomer'
import Intro from '../components/text/Intro'
import Text from '../components/text/Text'
import WrapperOrganization from '../components/layout/WrapperOrganization'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionPastDue({
  email,
  organization,
  product,
  subscription,
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
          <CTASection>
            <Button href={payment_url}>Update payment method</Button>
          </CTASection>
          <Text>
            You can also{' '}
            <EmailLink href={url}>manage your subscription</EmailLink>.
          </Text>
        </>
      ) : (
        <CTASection>
          <Button href={url}>Manage subscription</Button>
        </CTASection>
      )}

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionPastDue.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'past_due',
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  payment_url: 'https://invoice.stripe.com/i/acct_123/test',
}

export default SubscriptionPastDue
