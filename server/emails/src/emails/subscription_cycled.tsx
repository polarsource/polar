import {
  Heading,
  Hr,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionCycled({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionCycledProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your subscription to {product.name} has been renewed</Preview>
      <Section>
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has been renewed
        </Heading>
        <BodyText>
          Your subscription to <span className="font-bold">{product.name}</span>{' '}
          has been renewed.
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Manage my subscription</Button>
      </Section>
      <Hr />
      <OrderSummary order={order} />
      <Section className="mt-6 border-t border-gray-200 pt-4 pb-4">
        <Text className="m-0 text-xs text-gray-600">
          If you're having trouble with the button above, copy & paste the URL
          below into your web browser.
        </Text>
        <Text className="mt-2 mb-0 text-xs">
          <Link href={url} className="break-all text-blue-600 underline">
            {url}
          </Link>
        </Text>
      </Section>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionCycled.PreviewProps = {
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

export default SubscriptionCycled
