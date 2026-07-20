import {
  Button,
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
  access_ends_at,
  deadline,
}: schemas['SubscriptionPastDueProps']) {
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

  return (
    <WrapperOrganization
      organization={organization}
      preview={`Action needed: your ${product.name} payment failed`}
    >
      <Intro headline="Your payment failed">
        We couldn&rsquo;t charge your card on file for your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription renewal. This is usually an expired card, insufficient
        funds, or a temporary bank hold. We&rsquo;ll try again over the next few
        days.
      </Intro>
      {access_ends_at ? (
        <Text>
          You&rsquo;ll keep access to{' '}
          <Text as="span" weight="medium">
            {product.name}
          </Text>{' '}
          until {formatDate(access_ends_at)}. Update your payment method before
          then to avoid any interruption.
        </Text>
      ) : (
        <>
          <Text>
            Your access to{' '}
            <Text as="span" weight="medium">
              {product.name}
            </Text>{' '}
            is paused until payment goes through.
          </Text>
          {deadline && (
            <Text>
              If we still can&rsquo;t charge your card, your subscription will
              be canceled on{' '}
              <Text as="span" weight="medium">
                {formatDate(deadline)}
              </Text>
              .
            </Text>
          )}
        </>
      )}
      <Button href={url}>Update payment method</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionPastDue.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  access_ends_at: null,
  deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
}

export default SubscriptionPastDue
