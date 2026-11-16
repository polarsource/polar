import { estimateMeteredCost } from '@/components/Products/ProductForm/Pricing/utils'
import { isMeteredPrice, MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'

export interface MeterCreditOption {
  meter: schemas['Meter']
  balance: number
  unitPrice: MeteredPrice | null
  productName: string | null
}

/**
 * Live meters, plus older versions the customer is billed on, plus the
 * preselected meter. Not every version: credits only count on a billed one.
 */
export const getMeterCreditOptions = (
  liveMeters: schemas['Meter'][],
  subscriptions: schemas['Subscription'][],
  customerMeters: schemas['CustomerMeter'][],
  selectedMeterId?: string,
): MeterCreditOption[] => {
  const meteredPrices = subscriptions.flatMap((subscription) =>
    subscription.prices
      .filter(isMeteredPrice)
      .map((price) => ({ price, subscription })),
  )

  // subscription.meters keeps meters from earlier products
  const billedMeters = subscriptions
    .flatMap((subscription) => subscription.meters.map((m) => m.meter))
    .filter((meter) =>
      meteredPrices.some(({ price }) => price.meter_id === meter.id),
    )
  const selectedMeter = customerMeters.find(
    (cm) => cm.meter_id === selectedMeterId,
  )?.meter

  const meters = new Map<string, schemas['Meter']>()
  for (const meter of [...liveMeters, ...billedMeters, selectedMeter]) {
    if (meter && !meter.archived_at) meters.set(meter.id, meter)
  }

  return [...meters.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((meter) => {
      const billing = meteredPrices.find(
        ({ price }) => price.meter_id === meter.id,
      )
      return {
        meter,
        balance:
          customerMeters.find((cm) => cm.meter_id === meter.id)?.balance ?? 0,
        unitPrice: billing?.price ?? null,
        productName: billing?.subscription.product.name ?? null,
      }
    })
}

export interface CreditPreview {
  balanceAfter: number
  overage: { before: number; after: number; currency: string } | null
}

export const getCreditPreview = (
  { balance, unitPrice }: MeterCreditOption,
  units: number,
): CreditPreview => {
  const balanceAfter = balance + units
  if (!unitPrice || balance >= 0) {
    return { balanceAfter, overage: null }
  }
  const overageCost = (value: number) =>
    value < 0 ? estimateMeteredCost(unitPrice, -value) : 0
  return {
    balanceAfter,
    overage: {
      before: overageCost(balance),
      after: overageCost(balanceAfter),
      currency: unitPrice.price_currency,
    },
  }
}

export const MAX_CREDIT_UNITS = 1_000_000_000

const stripSeparators = (input: string) => input.replace(/[\s,_]/g, '')

export const validateCreditUnits = (input: string): true | string => {
  const digits = stripSeparators(input)
  if (!digits) return 'Enter an amount'
  if (!/^\d+$/.test(digits)) return 'Enter a whole number'
  const units = Number(digits)
  if (units < 1) return 'Enter at least 1 credit'
  if (units > MAX_CREDIT_UNITS) return 'Enter at most 1,000,000,000 credits'
  return true
}

export const parseCreditUnits = (input: string): number | null =>
  validateCreditUnits(input) === true ? Number(stripSeparators(input)) : null

export const formatCredits = (units: number) =>
  `${units.toLocaleString('en-US')} ${units === 1 ? 'credit' : 'credits'}`
