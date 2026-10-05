import { SchemaError } from './error'

const MINOR_DIGITS = { usd: 2 } as const
const MAX_MINOR_WHOLE_DIGITS = 5
const MAX_MINOR_FRACTION_DIGITS = 12
const MAX_SIGNIFICANT_DIGITS = 15

export type Currency = keyof typeof MINOR_DIGITS

export interface Money {
  /** Per unit, in the currency's minor unit (cents for usd), as a decimal string. */
  readonly amount: string
  readonly currency: Currency
}

interface Decimal {
  readonly digits: string
  readonly point: number
}

export function usd(dollars: number): Money {
  return money(dollars, 'usd')
}

function money(amount: number, currency: Currency): Money {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    throw new SchemaError(
      currency,
      `amount must be a non-negative number, got ${String(amount)}`,
    )
  }
  const { digits, point } = parseDecimal(amount)
  if (digits.replace(/^0+|0+$/g, '').length > MAX_SIGNIFICANT_DIGITS) {
    throw new SchemaError(
      currency,
      `amount has more than ${MAX_SIGNIFICANT_DIGITS} significant digits, got ${amount}`,
    )
  }
  const minorDigits = MINOR_DIGITS[currency]
  const minor = formatDecimal({ digits, point: point + minorDigits })
  const [whole = '', fraction = ''] = minor.split('.')
  if (whole.length > MAX_MINOR_WHOLE_DIGITS) {
    throw new SchemaError(
      currency,
      `amount must be less than ${10 ** (MAX_MINOR_WHOLE_DIGITS - minorDigits)}, got ${amount}`,
    )
  }
  if (fraction.length > MAX_MINOR_FRACTION_DIGITS) {
    throw new SchemaError(
      currency,
      `amount can have at most ${MAX_MINOR_FRACTION_DIGITS + minorDigits} decimal places, got ${amount}`,
    )
  }
  return { amount: minor, currency }
}

/** Reads the exact digits JavaScript prints for a number, without float math. */
function parseDecimal(value: number): Decimal {
  const [mantissa = '', exponent = '0'] = String(value).split('e')
  const [whole = '', fraction = ''] = mantissa.split('.')
  return { digits: whole + fraction, point: whole.length + Number(exponent) }
}

function formatDecimal({ digits, point }: Decimal): string {
  const padded =
    point < 1 ? '0'.repeat(1 - point) + digits : digits.padEnd(point, '0')
  const split = Math.max(point, 1)
  const whole = padded.slice(0, split).replace(/^0+(?=\d)/, '')
  const fraction = padded.slice(split).replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}
