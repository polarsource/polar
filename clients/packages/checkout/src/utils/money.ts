export const formatCurrencyNumber = (
  cents: number,
  currency: string,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number,
): string => {
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  })

  return currencyNumberFormat.format(cents / 100)
}

export const formatUnitAmount = (cents: number, currency: string): string =>
  formatCurrencyNumber(cents, currency, 2, 14)
