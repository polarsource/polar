import { TaxBehavior } from './bulkTaxRecords'

export const TAX_NAMES: Record<TaxBehavior, string> = {
  inclusive: 'inclusive',
  exclusive: 'exclusive',
}

const numberFormat = new Intl.NumberFormat('en-US')

export const formatCount = (count: number) => numberFormat.format(count)

export const subscriptionsLabel = (count: number) =>
  `${formatCount(count)} ${count === 1 ? 'subscription' : 'subscriptions'}`
