import { Heading, Link, Preview, Section, Text } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import Footer from '../components/Footer'
import OrganizationHeader from '../components/OrganizationHeader'
import Wrapper from '../components/Wrapper'

interface SubscriptionUpgradeProps {
  organization: {
    name: string
    slug: string
  }
  product: {
    name: string
    benefits: Array<{ description: string }>
  }
  previous_product: {
    name: string
  }
  url: string
}

export function SubscriptionUpgrade({
  organization,
  product,
  previous_product,
  url,
}: SubscriptionUpgradeProps) {
  return (
    <Wrapper>
      <Preview>Your subscription has been upgraded to {product.name}!</Preview>
      <OrganizationHeader organization={organization} />
      <Section className="pt-10">
        <Heading
          as="h1"
          className="text-xl font-bold text-gray-900 dark:text-white"
        >
          Your subscription has been upgraded!
        </Heading>
        <BodyText>
          Great news! Your subscription has been successfully upgraded from{' '}
          <span className="font-medium">{previous_product.name}</span> to{' '}
          <span className="font-bold">{product.name}</span>.
        </BodyText>
        {product.benefits && product.benefits.length > 0 && (
          <>
            <BodyText>Your new subscription includes:</BodyText>
            <ul className="mt-2 list-disc pl-6">
              {product.benefits.map((benefit, index) => (
                <li
                  key={index}
                  className="mb-1 text-gray-700 dark:text-gray-300"
                >
                  {benefit.description}
                </li>
              ))}
            </ul>
          </>
        )}
        <BodyText>
          The changes take effect immediately and will be reflected in your next
          billing cycle.
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>View my subscription</Button>
      </Section>
      <Section className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-700">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          If you're having trouble with the button above, copy and paste the URL
          below into your web browser.
        </Text>
        <Text className="text-sm">
          <Link
            href={url}
            className="text-blue-600 underline dark:text-blue-400"
          >
            {url}
          </Link>
        </Text>
      </Section>
      <Footer />
    </Wrapper>
  )
}

SubscriptionUpgrade.PreviewProps = {
  organization: {
    name: 'Acme Inc.',
    slug: 'acme-inc',
  },
  product: {
    name: 'Pro Plan',
    benefits: [
      { description: 'Unlimited projects' },
      { description: 'Priority support' },
      { description: 'Advanced analytics' },
    ],
  },
  previous_product: {
    name: 'Basic Plan',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUpgrade
