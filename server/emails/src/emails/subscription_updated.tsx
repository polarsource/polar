import {
  Heading,
  Hr,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import Benefits from '../components/Benefits'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import OrderSummary from '../components/OrderSummary'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionUpdated({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionUpdatedProps']) {
  return (
    <Wrapper>
      <Preview>Your subscription has been updated to {product.name}</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has been updated
        </Heading>
        <BodyText>
          Your subscription has been successfully changed to{' '}
          <span className="font-bold">{product.name}</span>.
        </BodyText>
      </Section>
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Section className="my-8 text-center">
        <Button href={url}>View my subscription</Button>
      </Section>
      <Hr />
      {order ? (
        <>
          <Section>
            <BodyText>
              The changes take effect immediately. The pro-rated amount has been
              charged to your account as part of this update.
            </BodyText>
          </Section>
          <OrderSummary order={order} />
        </>
      ) : (
        <Section>
          <BodyText>
            The changes take effect immediately. The pro-rated amount will be
            reflected on your next billing cycle.
          </BodyText>
        </Section>
      )}

      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser.
        </Text>
        <Text className="text-sm">
          <Link href={url} className="text-blue-600 underline">
            {url}
          </Link>
        </Text>
      </Section>
      <FooterCustomer organization={organization} email={email} />
    </Wrapper>
  )
}

SubscriptionUpdated.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'active',
  },
  order,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUpdated
