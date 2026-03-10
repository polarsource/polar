import { Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionTrialConversionReminder({
  email,
  organization,
  product,
  subscription,
  url,
  conversion_date,
}: schemas['SubscriptionTrialConversionReminderProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>
        Your trial for {product.name} is ending on {conversion_date}
      </Preview>
      <Intro headline="Your trial is ending soon">
        Your trial for{' '}
        <span className="font-medium">{product.name}</span> will end on{' '}
        {conversion_date}, and your subscription will begin.
      </Intro>
      <BodyText>
        If you wish to make any changes before your trial ends, you can manage
        your subscription from your customer portal.
      </BodyText>
      <Section className="my-8 text-center">
        <Button href={url}>Manage subscription</Button>
      </Section>

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionTrialConversionReminder.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {},
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  conversion_date: 'March 17, 2026',
}

export default SubscriptionTrialConversionReminder
