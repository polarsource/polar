export * from './dom'
export * from './github'
export * from './useOutsideClick'

export const getServerURL = (path?: string): string => {
  path = path !== undefined ? path : ''
  const baseURL = process?.env?.NEXT_PUBLIC_API_URL
  const baseWithPath = `${baseURL}${path}`
  return baseWithPath
}

export const getCentsInDollarString = (
  cents: number,
  showCents = false,
): string => {
  const dollars = cents / 100
  if (cents % 100 === 0 && !showCents) {
    return dollars.toFixed(0)
  } else {
    return dollars.toFixed(2)
  }
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
