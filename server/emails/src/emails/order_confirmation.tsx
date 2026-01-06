import {
  getEmailTranslations,
  isSupportedLocale,
  type SupportedLocale,
} from '../i18n'
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

export function OrderConfirmation({
  email,
  organization,
  product,
  order,
  url,
  locale = 'en',
}: schemas['OrderConfirmationProps'] & { locale?: string }) {
  const safeLocale: SupportedLocale = isSupportedLocale(locale) ? locale : 'en'
  const t = getEmailTranslations(safeLocale)

  return (
    <Wrapper>
      <Preview>
        {t.orderConfirmation.preview.replace('{description}', order.description)}
      </Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-12">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          {t.orderConfirmation.heading}
        </Heading>
        <BodyText>
          {t.orderConfirmation.processed
            .split('{description}')
            .map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>
                  {part}
                  <span className="font-bold">{order.description}</span>
                </span>
              ) : (
                part
              ),
            )}
        </BodyText>
      </Section>
      {product && (
        <>
          {product.benefits.length > 0 && (
            <Benefits benefits={product.benefits} />
          )}
          <Section className="my-8 text-center">
            <Button href={url}>{t.common.accessPurchase}</Button>
          </Section>
        </>
      )}
      <Hr />
      <OrderSummary order={order} />
      <Hr />
      <Section className="mt-6 border-t border-gray-200 pt-6">
        <Text className="text-sm text-gray-600">{t.common.troubleWithButton}</Text>
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

OrderConfirmation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  order,
  url: 'https://polar.sh/acme-inc/portal/orders/12345',
  locale: 'en',
}

export default OrderConfirmation
