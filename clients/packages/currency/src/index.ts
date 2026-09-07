const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])

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
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())) {
    return 1
  }
  return 100
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

const scrubTrailingZeros = (formatted: string): string =>
  formatted.replace(/[.,]00([^\d]*)$/, '$1')

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
    minimumFractionDigits: isDecimalCurrency(currency) ? 2 : 0,
  })

  return scrubTrailingZeros(currencyNumberFormat.format(cents / decimalFactor))
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
    minimumFractionDigits: isDecimalCurrency(currency) ? 2 : 0,
  })

  return scrubTrailingZeros(currencyNumberFormat.format(cents / decimalFactor))
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
  const displayValue = cents / decimalFactor

  // >= $1M: compact notation with multipliers
  if (Math.abs(displayValue) >= 1_000_000) {
    return new Intl.NumberFormat(locales, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      compactDisplay: 'short',
      maximumSignificantDigits: 5,
      maximumFractionDigits: 3,
      roundingPriority: 'lessPrecision',
    }).format(displayValue)
  }

  // $10K–$999K: no decimals, truncated
  if (Math.abs(displayValue) >= 10_000) {
    return new Intl.NumberFormat(locales, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.trunc(displayValue))
  }

  // Under $10K: standard formatting, either 0 or 2 decimals
  return scrubTrailingZeros(
    new Intl.NumberFormat(locales, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: isDecimalCurrency(currency) ? 2 : 0,
      maximumFractionDigits: isDecimalCurrency(currency) ? 2 : 0,
    }).format(displayValue),
  )
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
    maximumFractionDigits: 6,
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

/**
 * Returns the decimal separator (`.` or `,`) used by a given locale to format
 * fractional numbers.
 *
 * Money inputs need this to decide whether a typed/pasted comma is a decimal
 * separator (e.g. `de` → `12,50`) or a thousands separator (e.g. `en` → `5,000`).
 * Defaults to `.` when the locale resolves to a period-separated format.
 *
 * @param locale - BCP-47 locale tag (e.g. `'en'`, `'de'`, `'fr-FR'`)
 * @returns `'.'` or `','`
 * @example
 * getLocaleDecimalSeparator('en') // '.'
 * getLocaleDecimalSeparator('de') // ','
 */
export const getLocaleDecimalSeparator = (
  locale: Intl.LocalesArgument,
): '.' | ',' => {
  const formatted = new Intl.NumberFormat(locale).format(1.1)
  return formatted.includes(',') ? ',' : '.'
}

/**
 * Normalizes a raw money input string into a display string using `.` as the
 * decimal separator, interpreting separators according to the locale's decimal
 * separator.
 *
 * Used by `MoneyInput` to convert what a user types or pastes into a stable
 * display value before it is turned into minor units (cents).
 *
 * Rules:
 * - Strips everything except digits, commas, and periods.
 * - The locale's decimal separator, when present, is the decimal point; the
 *   other separator is treated as a thousands separator and stripped.
 * - For period-decimal locales (`en`, `ja`, …) a comma is always a thousands
 *   separator, so `5,000` → `5000` (never collapsed to `5.00`).
 * - For comma-decimal locales (`de`, `fr`, …) the committed value is displayed
 *   with a period (see `MoneyInput`'s `getInternalValue`, which uses
 *   `toFixed`), so a period in an input that has no comma is treated as the
 *   decimal point to keep editing those values correct (e.g. `12.50` → `12.50`).
 * - At most one decimal separator is honored (the last one); earlier
 *   occurrences are stripped from the integer part.
 * - The fractional part is rounded to at most 2 digits.
 * - A trailing decimal separator with no fractional digits yet (e.g. `5.`) is
 *   preserved so the user can keep typing decimals; a blur handler is expected
 *   to strip it.
 *
 * @param input - Raw input string (may contain any characters)
 * @param decimalSeparator - The locale's decimal separator (`.` or `,`)
 * @returns A normalized display string with `.` as the decimal separator
 * @example
 * parseMoneyValue('5,000', '.')   // '5000'
 * parseMoneyValue('5,000.99', '.')   // '5000.99'
 * parseMoneyValue('12,50', ',')  // '12.50'
 * parseMoneyValue('1.234,56', ',')   // '1234.56'
 * parseMoneyValue('12.50', ',')  // '12.50' (editing a period-displayed value)
 */
export const parseMoneyValue = (
  input: string,
  decimalSeparator: '.' | ',',
): string => {
  const cleaned = input.replace(/[^0-9,.]/g, '')
  if (cleaned === '') return ''

  // Determine which separator acts as the decimal point in this input.
  // - The locale's decimal separator is preferred when present.
  // - For comma-decimal locales the committed value is displayed with a
  //   period, so a period in an input that has no comma is treated as the
  //   decimal to keep editing those values correct.
  // - For period-decimal locales a lone comma is always a thousands separator
  //   (the reported bug: "5,000" must not collapse to "5.00").
  let decimalSep: '.' | ',' | null
  if (cleaned.includes(decimalSeparator)) {
    decimalSep = decimalSeparator
  } else if (decimalSeparator === ',' && cleaned.includes('.')) {
    decimalSep = '.'
  } else {
    decimalSep = null
  }

  if (decimalSep === null) {
    // No decimal point: strip any thousands separators from the pure integer.
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.'
    return cleaned.split(thousandsSeparator).join('')
  }

  // Strip the thousands separator (the character that is not the decimal point)
  const thousandsSeparator = decimalSep === '.' ? ',' : '.'
  const withoutThousands = cleaned.split(thousandsSeparator).join('')
  const lastSepIndex = withoutThousands.lastIndexOf(decimalSep)

  // Integer part: everything before the last decimal separator, with any
  // earlier stray decimal separators stripped
  const integerPart = withoutThousands
    .slice(0, lastSepIndex)
    .split(decimalSep)
    .join('')
  const decimalPart = withoutThousands.slice(lastSepIndex + 1)

  // Trailing decimal separator with no decimals yet (e.g. "5." or "12,"):
  // keep it so the user can continue typing decimals
  if (decimalPart === '') {
    return integerPart.length > 0 ? `${integerPart}.` : '.'
  }

  const maxDecimalPrecision = 2
  const trimmedDecimalPart = decimalPart.slice(0, maxDecimalPrecision)
  const parsedValue = Number.parseFloat(`${integerPart}.${trimmedDecimalPart}`)

  if (Number.isNaN(parsedValue)) {
    return integerPart
  }

  const decimalPlaces = Math.min(maxDecimalPrecision, decimalPart.length)
  const formatted = parsedValue.toFixed(decimalPlaces)

  // When the integer part was deleted, avoid reinserting a leading "0" that
  // would make the caret jump to the end of the input
  return integerPart.length > 0 ? formatted : formatted.replace(/^0(?=\.)/, '')
}
