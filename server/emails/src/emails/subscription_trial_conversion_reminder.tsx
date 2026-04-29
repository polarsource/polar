import { Preview, Section } from 'react-email'
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
        Your {product.name} trial is ending on {conversion_date}
      </Preview>

      <Intro headline="Your trial is ending soon">
        Your <span className="font-medium">{product.name}</span> trial will end
        on <span className="font-medium">{conversion_date}</span> and your
        subscription will convert to a paid plan.
      </Intro>

      <BodyText>
        If you&rsquo;d like to make any changes or cancel before your trial
        ends, you can do so from your customer portal.
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
  conversion_date: '03/17/2026',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionTrialConversionReminder
