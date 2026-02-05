export const CURRENCY_DECIMAL_FACTORS: Record<string, number> = {
  aud: 100,
  brl: 100,
  cad: 100,
  chf: 100,
  eur: 100,
  inr: 100,
  gbp: 100,
  jpy: 1,
  sek: 100,
  usd: 100,
}

export const getCurrencyDecimalFactor = (currency: string): number => {
  return CURRENCY_DECIMAL_FACTORS[currency.toLowerCase()] ?? 100
}

export const isDecimalCurrency = (currency: string): boolean =>
  getCurrencyDecimalFactor(currency) === 100

type FormattingMode = 'presenting' | 'accounting' | 'statistics' | 'subcent'

const formatCurrencyPresenting = (cents: number, currency: string): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

const formatCurrencyAccounting = (cents: number, currency: string): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: isDecimalCurrency(currency) ? 2 : 0,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

const formatCurrencyStatistics = (cents: number, currency: string): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    notation: 'compact',
    compactDisplay: 'short',
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

const formatCurrencySubcent = (cents: number, currency: string): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 14,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}
/**
 * Format an amount with currency code (e.g., "$10.00").
 * Uses currencyDisplay: 'symbol' to show the currency.
 * To show "USD 10.00" instead, please pass 'code'
 * Automatically handles currencies with different decimal factors.
 */
export const formatCurrency =
  (mode: FormattingMode) =>
  (cents: number, currency: string): string => {
    switch (mode) {
      case 'presenting':
        return formatCurrencyPresenting(cents, currency)
      case 'accounting':
        return formatCurrencyAccounting(cents, currency)
      case 'statistics':
        return formatCurrencyStatistics(cents, currency)
      case 'subcent':
        return formatCurrencySubcent(cents, currency)
    }
  }
