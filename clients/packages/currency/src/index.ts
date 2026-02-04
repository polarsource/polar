/**
 * @polar-sh/currency
 *
 * Pure TypeScript currency utilities for Polar.
 * This package has no dependencies and can be used in any JavaScript/TypeScript environment.
 */

/**
 * Decimal factors for supported currencies.
 * Most currencies use 100 (cents), but some like JPY use 1 (no decimal places).
 */
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

/**
 * Get the decimal factor for a currency.
 * Returns 100 for unknown currencies (standard decimal currency).
 */
export const getCurrencyDecimalFactor = (currency: string): number => {
  return CURRENCY_DECIMAL_FACTORS[currency.toLowerCase()] ?? 100
}

/**
 * Format an amount with currency code (e.g., "USD 10.00").
 * Uses currencyDisplay: 'code' to show the currency code instead of symbol.
 * Automatically handles currencies with different decimal factors.
 */
export const formatCurrency = (
  cents: number,
  currency: string,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number,
  currencyDisplay: keyof Intl.NumberFormatOptionsCurrencyDisplayRegistry = 'code',
): string => {
  const decimalFactor = getCurrencyDecimalFactor(currency)
  const fractionDigits = decimalFactor === 1 ? 0 : 2

  const currencyNumberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay,
    minimumFractionDigits: minimumFractionDigits ?? fractionDigits,
    maximumFractionDigits: maximumFractionDigits ?? fractionDigits,
  })

  return currencyNumberFormat.format(cents / decimalFactor)
}

/**
 * Format a unit amount (e.g., for metered pricing).
 * Shows 2-14 decimal places to handle sub-cent pricing.
 */
export const formatUnitAmount = (cents: number, currency: string): string =>
  formatCurrency(cents, currency, 2, 14)
