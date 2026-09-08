import type { ListCustomers, ListVariants } from '@lemonsqueezy/lemonsqueezy.js'
import type { SubscriptionRecurringInterval } from '@polar-sh/sdk/models/components/subscriptionrecurringinterval.js'
import type { ProductCreate } from '../../../schemas/Product'

export const parseCustomers = (customers: ListCustomers['data']) =>
  customers.map((customer) => ({
    name: customer.attributes.name,
    email: customer.attributes.email,
    billingAddress: customer.attributes.country
      ? {
          country: customer.attributes.country,
          city: customer.attributes.city,
          state: customer.attributes.region,
        }
      : undefined,
  })) ?? []

const parseInterval = (
  interval: ListVariants['data'][number]['attributes']['interval'],
): SubscriptionRecurringInterval | null => {
  switch (interval) {
    case 'month':
      return 'month'
    case 'year':
      return 'year'
    default:
      return null
  }
}

export const parseVariants = (variants: ListVariants['data']) =>
  variants.map((variant) => ({
    name: variant.attributes.name,
    description: variant.attributes.description,
    prices: [parsePrice(variant)],
    recurringInterval: parseInterval(variant.attributes.interval),
  })) ?? []

export const parsePrice = (
  variant: ListVariants['data'][number],
): (typeof ProductCreate.Encoded)['prices'][number] => {
  const priceCurrency = 'usd'
  const priceAmount = variant.attributes.price

  if (priceAmount > 0) {
    return {
      amountType: 'fixed',
      priceAmount,
      priceCurrency,
    }
  }

  const payWhatYouWant = variant.attributes.pay_what_you_want

  if (payWhatYouWant) {
    return {
      amountType: 'custom',
      priceCurrency: 'USD',
      minimumAmount:
        variant.attributes.min_price < 50 ? 50 : variant.attributes.min_price,
      presetAmount: variant.attributes.suggested_price,
    }
  }

  return {
    amountType: 'free',
  }
}
