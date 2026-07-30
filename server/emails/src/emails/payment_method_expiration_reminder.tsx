import {
  Button,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import { organization } from '../preview'
import type { schemas } from '../types'

export function PaymentMethodExpirationReminder({
  email,
  organization,
  payment_method,
  product_names,
  expiration_date,
  url,
}: schemas['PaymentMethodExpirationReminderProps']) {
  const { brand, last4 } = payment_method.method_metadata
  const brandLabel = brand.charAt(0).toUpperCase() + brand.slice(1)
  const plural = product_names.length > 1
  const productList = plural
    ? `${product_names.slice(0, -1).join(', ')} and ${product_names.at(-1)}`
    : product_names[0]

  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your card ending in ${last4} will expire soon`}
    >
      <Intro headline="Your card expires soon">
        Your{' '}
        <Text as="span" weight="medium">
          {brandLabel}
        </Text>{' '}
        card ending in{' '}
        <Text as="span" weight="medium">
          {last4}
        </Text>{' '}
        that pays for your{' '}
        <Text as="span" weight="medium">
          {productList}
        </Text>{' '}
        subscription{plural ? 's' : ''} will expire soon (
        <Text as="span" weight="medium">
          {expiration_date}
        </Text>
        ).
      </Intro>
      <Text>
        To avoid an interruption, add an up-to-date payment method from your
        customer portal.
      </Text>
      <Button href={url}>Update payment method</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

PaymentMethodExpirationReminder.PreviewProps = {
  email: 'john@example.com',
  organization,
  payment_method: {
    id: '12345',
    method_metadata: {
      brand: 'visa',
      last4: '4242',
      exp_month: 4,
      exp_year: 2026,
    },
  },
  product_names: ['Premium'],
  expiration_date: 'April 2026',
  url: 'https://polar.sh/acme-inc/portal/settings',
}

export default PaymentMethodExpirationReminder
