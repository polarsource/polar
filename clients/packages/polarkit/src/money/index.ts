export const getCentsInDollarString = (
  cents: number,
  showCents = false,
  pretty = false,
): string => {
  const dollars = cents / 100

  let show: Number

  if (cents % 100 === 0 && !showCents) {
    show = Number(dollars.toFixed(0))
  } else {
    show = Number(dollars.toFixed(2))
  }

  if (pretty) {
    return show.toLocaleString()
  }

  return show.toString()
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
