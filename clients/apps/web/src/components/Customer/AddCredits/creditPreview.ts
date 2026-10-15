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
