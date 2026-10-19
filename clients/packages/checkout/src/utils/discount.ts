import type { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import type { AcceptedLocale } from '@polar-sh/i18n'
import { addDays, addMonths, addWeeks, addYears } from 'date-fns'

type CheckoutDiscount =
  | schemas['CheckoutDiscountPercentageOnceForeverDuration']
  | schemas['CheckoutDiscountFixedOnceForeverDuration']
  | schemas['CheckoutDiscountPercentageRepeatDuration']
  | schemas['CheckoutDiscountFixedRepeatDuration']

const isDiscountFixed = (
  discount: CheckoutDiscount,
): discount is
  | schemas['CheckoutDiscountFixedOnceForeverDuration']
  | schemas['CheckoutDiscountFixedRepeatDuration'] => {
  return discount.type === 'fixed'
}

const isDiscountPercentage = (
  discount: CheckoutDiscount,
): discount is
  | schemas['CheckoutDiscountPercentageOnceForeverDuration']
  | schemas['CheckoutDiscountPercentageRepeatDuration'] => {
  return discount.type === 'percentage'
}

export const isTemporaryDiscount = (
  discount: CheckoutDiscount | null | undefined,
): discount is CheckoutDiscount => {
  return !!discount && discount.duration !== 'forever'
}

export const addBillingInterval = (
  date: Date,
  interval: string,
  count: number | null,
): Date => {
  const c = count ?? 1
  switch (interval) {
    case 'day':
      return addDays(date, c)
    case 'week':
      return addWeeks(date, c)
    case 'month':
      return addMonths(date, c)
    case 'year':
      return addYears(date, c)
    default:
      return addMonths(date, c)
  }
}

export const getDiscountEndDate = (
  baseDate: Date,
  discount: CheckoutDiscount,
  interval: string | null,
  intervalCount: number | null,
): Date => {
  const nextCycle = interval
    ? addBillingInterval(baseDate, interval, intervalCount)
    : addMonths(baseDate, intervalCount ?? 1)
  if (discount.duration === 'once') {
    return nextCycle
  }
  if (
    'duration_in_months' in discount &&
    typeof discount.duration_in_months === 'number'
  ) {
    const endDate = addMonths(baseDate, discount.duration_in_months)
    return endDate > nextCycle ? endDate : nextCycle
  }
  return baseDate
}

export const getDiscountDisplay = (
  discount: CheckoutDiscount,
  locale?: AcceptedLocale,
): string => {
  if (isDiscountPercentage(discount)) {
    const percentageFormatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 2,
    })
    return percentageFormatter.format(-discount.basis_points / 10000)
  }
  if (isDiscountFixed(discount)) {
    return formatCurrency('compact', locale)(
      -discount.amount,
      discount.currency,
    )
  }
  throw new Error('Unknown discount type')
}
