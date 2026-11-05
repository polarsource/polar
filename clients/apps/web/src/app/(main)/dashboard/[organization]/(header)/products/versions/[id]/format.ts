import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'

type Config = schemas['ConfigExportDocument']
type Product = schemas['ConfigProductRead']
type Price = schemas['ConfigProductPriceRead']

export const plural = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

const humanize = (key: string) => capitalize(key.replaceAll('_', ' '))

const intervalAdverb: Record<string, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
}

const cadence = (interval: string | null, count: number | null) => {
  if (!interval) return null
  return count && count > 1
    ? `Every ${plural(count, interval)}`
    : intervalAdverb[interval]
}

// Each interval and its count read as one field
export const productFields = ({
  name,
  description,
  visibility,
  recurring_interval,
  recurring_interval_count,
  trial_interval,
  trial_interval_count,
  meter_interval,
  meter_interval_count,
  ...product
}: Product) => ({
  name,
  description,
  visibility,
  billing: cadence(recurring_interval, recurring_interval_count) ?? 'One-time',
  trial: trial_interval
    ? plural(trial_interval_count ?? 1, trial_interval)
    : null,
  meter_cycle: cadence(meter_interval, meter_interval_count),
  ...product,
})

const fieldLabels: Record<string, string> = {
  prices: 'Price',
  benefits: 'Benefit',
}

export const fieldLabel = (field: string) =>
  fieldLabels[field] ?? humanize(field)

const enumFields = new Set(['visibility', 'type'])

export const valueFormatter = (configs: Config[]) => {
  const benefits = new Map(
    configs.flatMap(({ benefits }) =>
      benefits.map((benefit) => [benefit.external_id, benefit.description]),
    ),
  )
  const meters = new Map(
    configs.flatMap(({ meters }) =>
      meters.map((meter) => [meter.external_id, meter.name]),
    ),
  )
  const meterName = (externalId: string) => meters.get(externalId) ?? externalId

  const formatPrice = (price: Price) => {
    switch (price.amount_type) {
      case 'fixed':
        return formatCurrency('standard')(
          price.price_amount,
          price.price_currency,
        )
      case 'metered_unit':
        return `${formatCurrency('subcent')(Number(price.unit_amount), price.price_currency)} / ${meterName(price.meter)}`
      default:
        return JSON.stringify(price)
    }
  }

  return (field: string, value: unknown): string => {
    if (field === 'prices') return formatPrice(value as Price)
    if (field === 'benefits') {
      return benefits.get(value as string) ?? String(value)
    }
    if (field === 'meter') return meterName(value as string)
    if (enumFields.has(field)) return humanize(String(value))
    if (typeof value === 'number') return value.toLocaleString('en-US')
    if (typeof value === 'boolean') return value ? 'On' : 'Off'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
}
