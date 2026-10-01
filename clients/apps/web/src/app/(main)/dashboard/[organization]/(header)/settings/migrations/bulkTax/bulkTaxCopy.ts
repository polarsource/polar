import { TaxBehavior } from './bulkTaxRecords'

export const TAX_LABELS: Record<TaxBehavior, string> = {
  inclusive: 'Inclusive',
  exclusive: 'Exclusive',
}

const numberFormat = new Intl.NumberFormat('en-US')

export const formatCount = (count: number) => numberFormat.format(count)

export const subscriptionsLabel = (count: number) =>
  `${formatCount(count)} ${count === 1 ? 'subscription' : 'subscriptions'}`
