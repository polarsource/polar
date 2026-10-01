import { schemas } from '@polar-sh/client'

type TaxBehavior = schemas['TaxBehavior']

export const TAX_LABELS: Record<TaxBehavior, string> = {
  inclusive: 'Inclusive',
  exclusive: 'Exclusive',
}

export const TAX_OPTIONS: { value: TaxBehavior; label: string }[] = [
  { value: 'inclusive', label: TAX_LABELS.inclusive },
  { value: 'exclusive', label: TAX_LABELS.exclusive },
]

export const TAX_DESCRIPTIONS: Record<TaxBehavior, string> = {
  inclusive:
    'Customers keep paying the listed price. Polar takes tax out of it.',
  exclusive: 'Customers pay the listed price plus tax.',
}

export const EXCLUSIVE_WARNING_TITLE = 'Customers will pay more'

export const EXCLUSIVE_WARNING =
  'Exclusive means customers pay the price plus tax. Once switched, their Polar invoices will be higher than what they pay on Stripe today.'

const numberFormat = new Intl.NumberFormat('en-US')

export const formatCount = (count: number) => numberFormat.format(count)

export const subscriptionsLabel = (count: number) =>
  `${formatCount(count)} ${count === 1 ? 'subscription' : 'subscriptions'}`

export const applyLabel = (target: TaxBehavior, count: number) =>
  `Make ${subscriptionsLabel(count)} ${TAX_LABELS[target].toLowerCase()}`
