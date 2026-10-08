import type { schemas } from './types'

const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])

const isZeroDecimalCurrency = (currency: string): boolean =>
  ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())

export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
): string => {
  const zeroDecimal = isZeroDecimalCurrency(currency)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(zeroDecimal ? amount : amount / 100)
}

export const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

export const formatShortDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

export const formatInterval = (
  interval: schemas['SubscriptionEmail']['recurring_interval'],
  count: number,
): string => (count > 1 ? `every ${count} ${interval}s` : `every ${interval}`)
