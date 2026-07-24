import {
  Button,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionTrialConversionReminder({
  email,
  organization,
  product,
  url,
  conversion_date,
}: schemas['SubscriptionTrialConversionReminderProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} trial is ending on ${conversion_date}`}
    >
      <Intro headline="Your trial is ending soon">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        trial will end on{' '}
        <Text as="span" weight="medium">
          {conversion_date}
        </Text>{' '}
        and your subscription will convert to a paid plan.
      </Intro>
      <Text>
        If you&rsquo;d like to make any changes or cancel before your trial
        ends, you can do so from your customer portal.
      </Text>
      <Button href={url}>Manage subscription</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionTrialConversionReminder.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'trialing',
  },
  conversion_date: 'March 17, 2026',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionTrialConversionReminder
