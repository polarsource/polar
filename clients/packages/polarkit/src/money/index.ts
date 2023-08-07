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
  currency: string,
  cents: number,
  showCents = false,
): string => {
  const dollars = cents / 100 // We call them dollars even though they may be any currency
  let amountString: string
  if (cents % 100 === 0 && !showCents) {
    amountString = dollars.toFixed(0)
  } else {
    amountString = dollars.toFixed(2)
  }

  if (currency === 'usd') {
    return `$${amountString}`
  } else if (currency === 'eur') {
    return `€${amountString}`
  } else if (currency === 'gbp') {
    return `£${amountString}`
  } else if (currency === 'sek' || currency === 'dkk' || currency === 'nok') {
    return `${amountString} kr`
  }

  // Fallback
  return `${currency.toUpperCase()} ${amountString}`
}
