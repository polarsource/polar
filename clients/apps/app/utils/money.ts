export const getCentsInDollarString = (
  cents: number,
  showCents = false,
  pretty = false,
): string => {
  const dollars = cents / 100

  const precision = cents % 100 === 0 && !showCents ? 0 : 2

  if (pretty) {
    return dollars.toLocaleString('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
    })
  }

  return dollars.toFixed(precision)
}

export const formatCurrencyAndAmount = (
  cents: number,
  currency: string = 'usd',
  minimumFractionDigits: number = 0,
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact',
  maximumFractionDigits: number = 2,
): string => {
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    notation,
    maximumFractionDigits,
  })

  return currencyNumberFormat.format(cents / 100)
}
