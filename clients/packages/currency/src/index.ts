const CURRENCY_DECIMAL_FACTORS: Record<string, number> = {
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

/**
 * Returns the decimal factor for a given currency.
 *
 * The decimal factor represents how many units of the smallest currency unit
 * make up one unit of the base currency. For most currencies (decimal currencies),
 * this is 100 (e.g., 100 cents = 1 USD). For non-decimal currencies like JPY,
 * this is 1 (no fractional units).
 *
 * @param currency - The currency code in lowercase (e.g., 'usd', 'eur', 'jpy')
 * @returns The decimal factor for the currency (100 for most currencies, 1 for JPY)
 * @example
 * // Returns 100 for USD
 * getCurrencyDecimalFactor('usd')
 * @example
 * // Returns 1 for JPY
 * getCurrencyDecimalFactor('jpy')
 */
export const getCurrencyDecimalFactor = (currency: string): number => {
  return CURRENCY_DECIMAL_FACTORS[currency.toLowerCase()] ?? 100
}

/**
 * Checks if a currency is a decimal currency.
 *
 * Decimal currencies are those that use 100 as their decimal factor (e.g., USD, EUR).
 * Non-decimal currencies like JPY use a factor of 1.
 *
 * @param currency - The currency code in lowercase (e.g., 'usd', 'eur', 'jpy')
 * @returns true if the currency is decimal (uses 100 as factor), false otherwise
 * @example
 * // Returns true for USD
 * isDecimalCurrency('usd')
 * @example
 * // Returns false for JPY
 * isDecimalCurrency('jpy')
 */
export const isDecimalCurrency = (currency: string): boolean =>
  getCurrencyDecimalFactor(currency) === 100

/**
 * Formatting modes for currency display
 */
type FormattingMode =
  | 'compact'
  | 'standard'
  | 'accounting'
  | 'statistics'
  | 'subcent'

const formatCurrencyCompact = (
  cents: number,
  currency: string,
  locales?: Intl.LocalesArgument,
): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

const formatCurrencyStandard = (
  cents: number,
  currency: string,
  locales?: Intl.LocalesArgument,
): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 0,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

const formatCurrencyAccounting = (
  cents: number,
  currency: string,
  locales?: Intl.LocalesArgument,
): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: isDecimalCurrency(currency) ? 2 : 0,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

const formatCurrencyStatistics = (
  cents: number,
  currency: string,
  locales?: Intl.LocalesArgument,
): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat(locales, {
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

const formatCurrencySubcent = (
  cents: number,
  currency: string,
  locales?: Intl.LocalesArgument,
): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const currencyNumberFormat = new Intl.NumberFormat(locales, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 14,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

/**
 * Formats currency amounts for display in various contexts.
 *
 * This function returns a curried function that takes the amount in cents and currency code
 * and returns a formatted string. The formatting behavior depends on the mode parameter.
 *
 * @param mode - The formatting mode to use:
 *   - 'compact': User-facing display with narrow currency symbol, hides unnecessary decimals
 *   - 'standard': Standard display with disambiguated currency symbols, hides unnecessary decimals
 *   - 'accounting': Formal display with disambiguated currency symbol, always shows decimals for decimal currencies
 *   - 'statistics': Compact display for charts/graphs, uses abbreviations (K, M, B)
 *   - 'subcent': High-precision display for very small amounts
 * @param locales - Optional locale specification. If undefined, the browser's default locale is used (recommended).
 *                  Use explicit locales only when you need consistent formatting across different environments.
 *
 * @returns A function that takes cents and currency and returns the formatted string
 *
 * @example
 * // Compact mode - user-friendly display, with narrow currency symbols and hidden decimals
 * const formatCompact = formatCurrency('compact')
 * formatCompact(12345, 'usd') // Returns: "$123.45"
 * formatCompact(12300, 'usd') // Returns: "$123" (hides .00)
 * formatCompact(12300, 'cad') // Returns: "$123" (ambiguous symbol for CAD)
 * formatCompact(12300, 'jpy') // Returns: "¥12,300"
 *
 * @example
 * // Standard mode - standard display with disambiguated currency symbols
 * const formatStandard = formatCurrency('standard')
 * formatStandard(12345, 'usd') // Returns: "$123.45"
 * formatStandard(12300, 'usd') // Returns: "$123" (hides .00)
 * formatStandard(12345, 'cad') // Returns: "CA$123.45" (disambiguated for CAD)
 * formatStandard(12300, 'jpy') // Returns: "¥12,300"
 *
 * @example
 * // Accounting mode - formal display with disambiguated currency symbols and decimals
 * const formatAccounting = formatCurrency('accounting')
 * formatAccounting(12345, 'usd') // Returns: "$123.45"
 * formatAccounting(12300, 'usd') // Returns: "$123.00" (always shows decimals)
 * formatAccounting(12300, 'jpy') // Returns: "¥12,300"
 *
 * @example
 * // Statistics mode - compact display for charts
 * const formatStatistics = formatCurrency('statistics')
 * formatStatistics(12345, 'usd') // Returns: "$123.5"
 * formatStatistics(4200000, 'usd') // Returns: "$42K"
 * formatStatistics(4212010, 'usd') // Returns: "$42.1K"
 * formatStatistics(12300, 'jpy') // Returns: "¥12.3K"
 *
 * @example
 * // Subcent mode - high precision for very small amounts
 * const formatSubcent = formatCurrency('subcent')
 * formatSubcent(1, 'usd') // Returns: "$0.01"
 * formatSubcent(0.00000001, 'usd') // Returns: "$0.0000000001"
 * formatSubcent(0.0000000101, 'usd') // Returns: "$0.000000000101"
 */
export const formatCurrency =
  (mode: FormattingMode, locales?: Intl.LocalesArgument) =>
  (cents: number, currency: string): string => {
    switch (mode) {
      case 'compact':
        return formatCurrencyCompact(cents, currency, locales)
      case 'standard':
        return formatCurrencyStandard(cents, currency, locales)
      case 'accounting':
        return formatCurrencyAccounting(cents, currency, locales)
      case 'statistics':
        return formatCurrencyStatistics(cents, currency, locales)
      case 'subcent':
        return formatCurrencySubcent(cents, currency, locales)
    }
  }
