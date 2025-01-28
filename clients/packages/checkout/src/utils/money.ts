export const formatCurrencyNumber = (
  cents: number,
  currency: string = 'usd',
  minimumFractionDigits?: number,
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact',
): string => {
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    notation,
  })

  return currencyNumberFormat.format(cents / 100)
}
