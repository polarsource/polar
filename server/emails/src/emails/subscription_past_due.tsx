import { Link, Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import { Intro } from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
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
    <WrapperOrganization organization={organization}>
      <Preview>
        Action needed: update your payment method for {product.name}
      </Preview>

      <Intro headline="We couldn&rsquo;t process your payment">
        We tried to charge your payment method for your{' '}
        <span className="font-medium">{product.name}</span> subscription, but it
        didn&rsquo;t go through. This can happen for a number of reasons, like
        an expired card or a temporary bank hold.
      </Intro>

      <BodyText>
        Until the payment goes through, your access to{' '}
        <span className="font-medium">{product.name}</span> won&rsquo;t be
        available.
      </BodyText>

      {payment_url ? (
        <>
          <Section className="my-8 text-center">
            <Button href={payment_url}>Update payment method</Button>
          </Section>
          <BodyText>
            You can also{' '}
            <Link href={url} className="text-blue-600 underline">
              manage your subscription
            </Link>
            .
          </BodyText>
        </>
      ) : (
        <Section className="my-8 text-center">
          <Button href={url}>Manage subscription</Button>
        </Section>
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
