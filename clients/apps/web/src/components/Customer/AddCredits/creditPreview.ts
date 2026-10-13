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
