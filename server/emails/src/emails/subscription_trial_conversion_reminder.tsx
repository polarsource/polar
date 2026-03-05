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
      <Preview>Your {product.name} trial ends on {conversion_date}</Preview>

      <Intro headline="Your trial is ending soon">
        Your <span className="font-medium">{product.name}</span> free trial will
        end on {conversion_date}, and your subscription will begin.
      </Intro>

      <BodyText>
        After the trial, you&rsquo;ll be charged automatically. If you&rsquo;d
        like to cancel before then, you can do so from your portal.
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
  subscription: {
    id: '12345',
    status: 'trialing',
  },
  conversion_date: 'March 5, 2026',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionTrialConversionReminder
