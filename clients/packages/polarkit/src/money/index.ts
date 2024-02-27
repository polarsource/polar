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
): string => {
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  })
  return currencyNumberFormat.format(cents / 100)
}
