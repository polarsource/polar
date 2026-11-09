import { formatCurrency } from '@polar-sh/currency'
import { schemas } from '@polar-sh/client'

export type Feature = schemas['Feature']
export type FeatureSummary = schemas['FeatureSummary']
export type FeatureCustomer = schemas['FeatureCustomer']
export type FeatureDetailCustomer = schemas['FeatureDetailCustomer']
export type FeaturePlan = schemas['FeaturePlan']
export type FeaturePeriod = schemas['FeaturePeriod']

export const customerKey = (customer: {
  customer_id: string | null
  external_customer_id: string | null
}) => customer.customer_id ?? customer.external_customer_id ?? ''

export interface Economics {
  revenue: number
  cost: number
  margin: number
  // Null when there is no revenue to take a share of.
  marginRate: number | null
}

export const economics = (item: {
  revenue: string | number
  cost: string | number
}): Economics => {
  const revenue = Number(item.revenue)
  const cost = Number(item.cost)
  const margin = revenue - cost
  return {
    revenue,
    cost,
    margin,
    marginRate: revenue > 0 ? margin / revenue : null,
  }
}

export const totalTokens = (item: {
  input_tokens: number
  output_tokens: number
}) => item.input_tokens + item.output_tokens

export const perUse = (amount: number, uses: number) =>
  uses > 0 ? amount / uses : 0

export const formatMarginRate = (rate: number | null) =>
  rate === null ? '' : `${(rate * 100).toFixed(Math.abs(rate) < 0.1 ? 1 : 0)}%`

// A cost with no revenue against it has no margin rate, but is still a loss.
// Without revenue there is no rate to judge, so it reads as muted, not a loss.
export const marginColor = ({ margin, marginRate }: Economics) =>
  marginRate === null
    ? ('muted' as const)
    : margin < 0
      ? ('danger' as const)
      : undefined

export const formatMargin = ({ cost, marginRate }: Economics) =>
  marginRate === null && cost > 0 ? 'No revenue' : formatMarginRate(marginRate)

// Unit amounts are often a fraction of a cent, so keep three significant
// digits below a cent, and up to four decimals above it.
export const formatUnitAmount = (cents: number, currency: string) =>
  new Intl.NumberFormat(
    'en-US',
    Math.abs(cents) >= 1
      ? {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }
      : { style: 'currency', currency, maximumSignificantDigits: 3 },
  ).format(cents / 100)

// Totals round to the cent, unless that would round them to zero.
export const formatAmount = (cents: number, currency: string) =>
  cents !== 0 && Math.abs(cents) < 1
    ? formatUnitAmount(cents, currency)
    : formatCurrency('statistics')(cents, currency)

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatCount = (value: number) =>
  value >= 10_000 ? compact.format(value) : value.toLocaleString('en-US')

export const formatTokens = (tokens: number) => compact.format(tokens)

export type Metric = 'cost' | 'unit_cost' | 'revenue' | 'uses' | 'tokens'

export const METRICS: { value: Metric; label: string }[] = [
  { value: 'cost', label: 'Cost' },
  { value: 'unit_cost', label: 'Cost per use' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'uses', label: 'Uses' },
  { value: 'tokens', label: 'Tokens' },
]

type Measured = {
  occurrences: number
  cost: string | number
  revenue: string | number
  input_tokens: number
  output_tokens: number
}

export const metricValue = (metric: Metric, item: Measured) => {
  switch (metric) {
    case 'cost':
      return Number(item.cost)
    case 'unit_cost':
      return perUse(Number(item.cost), item.occurrences)
    case 'revenue':
      return Number(item.revenue)
    case 'uses':
      return item.occurrences
    case 'tokens':
      return totalTokens(item)
  }
}

export const formatMetric = (
  metric: Metric,
  value: number,
  currency: string,
) => {
  switch (metric) {
    case 'cost':
    case 'revenue':
      return formatAmount(value, currency)
    case 'unit_cost':
      return formatUnitAmount(value, currency)
    case 'uses':
      return formatCount(value)
    case 'tokens':
      return formatTokens(value)
  }
}

// Index of the first period with any activity, so charts over all time start
// where the data does.
export const firstActive = (periods: Measured[]) => {
  const index = periods.findIndex(
    (p) => p.occurrences > 0 || Number(p.cost) > 0 || Number(p.revenue) > 0,
  )
  return index === -1 ? 0 : index
}

// Sums periods into one figure, so a per-use metric is taken over the total.
export const sumPeriods = (periods: Measured[]): Measured =>
  periods.reduce<Measured>(
    (sum, period) => ({
      occurrences: sum.occurrences + period.occurrences,
      cost: Number(sum.cost) + Number(period.cost),
      revenue: Number(sum.revenue) + Number(period.revenue),
      input_tokens: sum.input_tokens + period.input_tokens,
      output_tokens: sum.output_tokens + period.output_tokens,
    }),
    { occurrences: 0, cost: 0, revenue: 0, input_tokens: 0, output_tokens: 0 },
  )
