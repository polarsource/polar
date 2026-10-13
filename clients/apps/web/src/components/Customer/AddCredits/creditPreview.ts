import { estimateMeteredCost } from '@/components/Products/ProductForm/Pricing/utils'
import { MeteredPrice } from '@/utils/product'
import { schemas } from '@polar-sh/client'

export interface MeterCreditOption {
  meter: schemas['Meter']
  balance: number
  unitPrice: MeteredPrice | null
  productName: string | null
}

export interface CreditPreview {
  balanceAfter: number
  overage: { before: number; after: number; currency: string } | null
}

const overageCost = (price: MeteredPrice, balance: number) =>
  balance < 0 ? estimateMeteredCost(price, -balance) : 0

export const getCreditPreview = (
  option: MeterCreditOption,
  units: number,
): CreditPreview => {
  const balanceAfter = option.balance + units
  const before = option.unitPrice
    ? overageCost(option.unitPrice, option.balance)
    : 0
  if (!option.unitPrice || before === 0) {
    return { balanceAfter, overage: null }
  }
  return {
    balanceAfter,
    overage: {
      before,
      after: overageCost(option.unitPrice, balanceAfter),
      currency: option.unitPrice.price_currency,
    },
  }
}

export const parseCreditUnits = (raw: string): number | null => {
  const units = Number(raw.replace(/[,\s]/g, ''))
  if (!Number.isInteger(units) || units <= 0 || units > 1_000_000_000) {
    return null
  }
  return units
}

export const getMeterUnitLabel = (meter: schemas['Meter']): string => {
  if (meter.unit === 'custom' && meter.custom_label) {
    return meter.custom_label.endsWith('s')
      ? meter.custom_label
      : `${meter.custom_label}s`
  }
  if (meter.unit === 'token') return 'tokens'
  return 'units'
}
