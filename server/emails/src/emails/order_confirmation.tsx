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
import Footer from '../components/Footer'
import OrderSummary from '../components/OrderSummary'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function OrderConfirmation({
  organization,
  product,
  order,
  url,
}: schemas['OrderConfirmationProps']) {
  return (
    <Wrapper>
      <Preview>Thank you for your order of {product.name}!</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-12">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Thank you for your order!
        </Heading>
        <BodyText>
          Your order of <span className="font-bold">{product.name}</span> is now
          processed.
        </BodyText>
      </Section>
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Section className="my-8 text-center">
        <Button href={url}>Access my purchase</Button>
      </Section>
      <Hr />
      <OrderSummary order={order} />
      <Hr />
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
      <Footer />
    </Wrapper>
  )
}

OrderConfirmation.PreviewProps = {
  organization,
  product,
  order,
  url: 'https://polar.sh/acme-inc/portal/orders/12345',
}

export default OrderConfirmation
