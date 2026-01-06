import {
  getEmailTranslations,
  isSupportedLocale,
  type SupportedLocale,
} from '../i18n'
import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'
import { organization, product } from '../preview'
import type { schemas } from '../types'

function BenefitsSection({
  benefits,
  label,
}: {
  benefits: any[]
  label: string
}) {
  if (benefits.length === 0) {
    return null
  }
  return (
    <>
      <BodyText>{label}</BodyText>
      <ul className="list-disc space-y-1 pl-6">
        {benefits.map((benefit, index) => (
          <li key={index}>{benefit.description}</li>
        ))}
      </ul>
    </>
  )
}

export function SubscriptionCancellation({
  email,
  organization,
  product,
  subscription,
  url,
  locale = 'en',
}: schemas['SubscriptionCancellationProps'] & { locale?: string }) {
  const safeLocale: SupportedLocale = isSupportedLocale(locale) ? locale : 'en'
  const t = getEmailTranslations(safeLocale)

  const dateLocale =
    safeLocale === 'nl' ? 'nl-NL' : safeLocale === 'sv' ? 'sv-SE' : 'en-US'
  const endDate = new Date(subscription.ends_at!).toLocaleDateString(
    dateLocale,
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  )

  return (
    <Wrapper>
      <Preview>
        {t.subscriptionCancellation.preview.replace('{product}', product.name)}
      </Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          {t.subscriptionCancellation.heading}
        </Heading>
        <BodyText>
          {t.subscriptionCancellation.sorryToSeeYouGo
            .replace('{product}', product.name)
            .replace('{endDate}', endDate)
            .split(product.name)
            .map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>
                  {part}
                  <span className="font-bold">{product.name}</span>
                </span>
              ) : (
                part
              ),
            )}
        </BodyText>
        <BodyText>{t.subscriptionCancellation.changeYourMind}</BodyText>
        <BenefitsSection
          benefits={product.benefits}
          label={t.subscriptionCancellation.benefitsContinue}
        />
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>{t.common.manageSubscription}</Button>
      </Section>
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

SubscriptionCancellation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  locale: 'en',
}

export default SubscriptionCancellation
