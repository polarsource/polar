export const formatCurrencyNumber = (
  cents: number,
  currency: string = 'usd',
  minimumFractionDigits?: number,
): string => {
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
  })
  return currencyNumberFormat.format(cents / 100)
}
