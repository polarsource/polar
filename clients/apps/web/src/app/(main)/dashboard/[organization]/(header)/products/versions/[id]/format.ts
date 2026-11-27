import {
  AGGREGATION_DISPLAY_NAMES,
  formatProperty,
  OPERATOR_DISPLAY_NAMES,
} from '@/components/Meter/MeterFilterReadOnlyConfiguration'
import { BENEFIT_REVOCATION_GRACE_PERIOD_LABELS } from '@/components/Settings/BenefitRevocationGracePeriod'
import { taxBehaviorOptionDisplayNames } from '@/components/Settings/OrganizationPaymentSettings'
import { PRORATION_BEHAVIOR_LABELS } from '@/components/Settings/ProrationBehavior'
import { getUnitLabels } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { getMeterUnitFormat } from '@polar-sh/ui/lib/meterUnit'

type Config = schemas['ConfigExportDocument']
type Product = schemas['ConfigProductRead']
type Price = schemas['ConfigProductPriceRead']
type Tiers = schemas['ConfigTiersRead']
type Meter = schemas['ConfigMeterRead']
type Filter = schemas['Filter']
type CustomField = schemas['ConfigCustomFieldRead']
type CustomFieldReference = schemas['ConfigProductCustomFieldRead']
type SelectOption = schemas['CustomFieldSelectOption']
type Bounds = { ge?: number; le?: number }
type Settings = {
  payments: { currency: string; tax: schemas['TaxBehaviorOption'] }
  subscriptions: schemas['ConfigSettingsSubscriptionsRead']
  customer_portal: schemas['ConfigSettingsCustomerPortalRead']
}

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
  trial_payment_setup_required,
  meter_interval,
  meter_interval_count,
  ...product
}: Product) => ({
  name,
  description,
  visibility,
  billing: cadence(recurring_interval, recurring_interval_count) ?? 'One-time',
  trial: trial_interval
    ? `${plural(trial_interval_count ?? 1, trial_interval)}${trial_payment_setup_required !== null ? ', no payment method' : ''}`
    : null,
  meter_cycle: cadence(meter_interval, meter_interval_count),
  ...product,
})

const describeFilter = ({ conjunction, clauses }: Filter): string =>
  clauses
    .map((clause) =>
      'property' in clause
        ? `${formatProperty(clause.property)} ${OPERATOR_DISPLAY_NAMES[clause.operator]} ${clause.value}`
        : `(${describeFilter(clause)})`,
    )
    .join(` ${conjunction} `)

// The filter and aggregation each read as one field
export const meterFields = ({
  name,
  filter,
  aggregation,
  ...meter
}: Meter) => ({
  name,
  filter: describeFilter(filter) || 'All events',
  aggregation:
    aggregation.func === 'count'
      ? AGGREGATION_DISPLAY_NAMES.count
      : `${AGGREGATION_DISPLAY_NAMES[aggregation.func]} of ${formatProperty(aggregation.property)}`,
  ...meter,
})

const isoDate = (seconds: number) =>
  new Date(seconds * 1000).toISOString().slice(0, 10)

// Fields are matched by slug; the bounds read as minimum and maximum, as dates on a date field
export const customFieldFields = ({
  slug,
  name,
  type,
  properties,
  ...field
}: CustomField) => {
  const { ge, le, ...rest } = properties as Bounds
  const isDate = type === 'date'
  return {
    external_id: slug,
    name,
    slug,
    type,
    ...rest,
    minimum: isDate && ge ? isoDate(ge) : ge,
    maximum: isDate && le ? isoDate(le) : le,
    ...field,
  }
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

export const customerPortalSettings = ({
  usage,
  subscription,
  customer,
}: schemas['OrganizationCustomerPortalSettings']): Settings['customer_portal'] => ({
  allow_plan_changes: subscription.update_plan,
  allow_unit_changes: subscription.update_units ?? false,
  allow_seat_management: subscription.update_seats,
  allow_pausing: subscription.pause ?? false,
  allow_email_changes: customer?.allow_email_change ?? false,
  show_metered_usage: usage.show,
})

export const settingsFields = ({
  payments,
  subscriptions,
  customer_portal,
}: Settings) => ({
  default_payment_currency: payments.currency.toUpperCase(),
  default_tax_behavior: taxBehaviorOptionDisplayNames[payments.tax],
  allow_multiple_subscriptions: yesNo(
    subscriptions.allow_multiple_subscriptions,
  ),
  prevent_trial_abuse: yesNo(subscriptions.prevent_trial_abuse),
  proration_behavior:
    PRORATION_BEHAVIOR_LABELS[subscriptions.proration_behavior],
  benefit_revocation_grace_period:
    BENEFIT_REVOCATION_GRACE_PERIOD_LABELS[
      subscriptions.benefit_revocation_grace_period
    ] ?? `After ${subscriptions.benefit_revocation_grace_period} Days`,
  allow_plan_changes: yesNo(customer_portal.allow_plan_changes),
  allow_unit_changes: yesNo(customer_portal.allow_unit_changes),
  allow_seat_management: yesNo(customer_portal.allow_seat_management),
  allow_pausing: yesNo(customer_portal.allow_pausing),
  allow_email_changes: yesNo(customer_portal.allow_email_changes),
  show_metered_usage: yesNo(customer_portal.show_metered_usage),
})

const listFieldLabels: Record<string, string> = {
  prices: 'Price',
  benefits: 'Benefit',
  custom_fields: 'Custom field',
  options: 'Option',
}

export const isListField = (field: string) => field in listFieldLabels

export const fieldLabel = (field: string) =>
  listFieldLabels[field] ?? humanize(field)

const enumFields = new Set(['visibility', 'type', 'unit'])

export const valueFormatter = (configs: Config[]) => {
  const benefits = new Map(
    configs.flatMap(({ benefits }) =>
      benefits.map((benefit) => [benefit.external_id, benefit.description]),
    ),
  )
  const meters = new Map(
    configs.flatMap(({ meters }) =>
      meters.map((meter) => [meter.external_id, meter]),
    ),
  )
  const customFields = new Map(
    configs.flatMap(({ custom_fields }) =>
      (custom_fields ?? []).map((field) => [field.slug, field.name]),
    ),
  )
  const meterName = (externalId: string) =>
    meters.get(externalId)?.name ?? externalId
  // Token and custom meters price per a display unit (e.g. 1M tokens), like the rest of the dashboard
  const meterUnit = (externalId: string) => {
    const meter = meters.get(externalId)
    const unit = meter?.unit ?? 'scalar'
    const { scale, label } = getMeterUnitFormat(unit, {
      customLabel: meter?.custom_label,
      customMultiplier: meter?.custom_multiplier,
    })
    const name = meterName(externalId)
    return { scale, label: unit === 'scalar' ? name : `${label} (${name})` }
  }

  const formatPrice = (price: Price) => {
    const rate = (amount: number | string, unit: string, scale = 1) =>
      `${formatCurrency('subcent')(Number(amount) * scale, price.price_currency)} / ${unit}`
    // Every tier is listed so a change to any one of them shows in the diff
    const tiered = ({ type, tiers }: Tiers, unit: string, scale = 1) => {
      const steps = tiers
        .map(({ bound, unit_amount }) =>
          bound === null
            ? rate(unit_amount, unit, scale)
            : `${rate(unit_amount, unit, scale)} up to ${bound.toLocaleString('en-US')}`,
        )
        .join(', then ')
      return tiers.length === 1 ? steps : `${capitalize(type)}: ${steps}`
    }
    const minimum = (count: number, unit: string) =>
      count > 1 ? `, minimum ${plural(count, unit)}` : ''
    const cap = (amount: number | null) =>
      amount
        ? `, capped at ${formatCurrency('standard')(amount, price.price_currency)}`
        : ''

    switch (price.amount_type) {
      case 'fixed':
        return formatCurrency('standard')(
          price.price_amount,
          price.price_currency,
        )
      case 'metered_unit': {
        const { label, scale } = meterUnit(price.meter)
        return `${rate(price.unit_amount, label, scale)}${cap(price.cap_amount)}`
      }
      case 'metered_tiers': {
        const { label, scale } = meterUnit(price.meter)
        return `${tiered(price.tiers, label, scale)}${cap(price.cap_amount)}`
      }
      case 'seat_based':
        return `${tiered(price.tiers, 'seat')}${minimum(price.minimum_units, 'seat')}`
      case 'unit_based': {
        const unit = getUnitLabels(price).unitLabel
        return `${tiered(price.tiers, unit)}${minimum(price.minimum_units, unit)}`
      }
    }
  }

  return (field: string, value: unknown): string => {
    if (field === 'prices') return formatPrice(value as Price)
    if (field === 'benefits') {
      return benefits.get(value as string) ?? String(value)
    }
    if (field === 'meter') return meterName(value as string)
    if (field === 'custom_fields') {
      const { field: slug, required } = value as CustomFieldReference
      return `${customFields.get(slug) ?? slug}${required ? '' : ', optional'}`
    }
    if (field === 'options') {
      const option = value as SelectOption
      return option.label === option.value
        ? option.label
        : `${option.label} (${option.value})`
    }
    if (enumFields.has(field)) return humanize(String(value))
    if (typeof value === 'number') return value.toLocaleString('en-US')
    if (typeof value === 'boolean') return value ? 'On' : 'Off'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
}
