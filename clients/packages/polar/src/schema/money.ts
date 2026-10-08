import { Schema } from 'effect'

export const Currency = Schema.Literals([
  'aed',
  'all',
  'amd',
  'aoa',
  'ars',
  'aud',
  'awg',
  'azn',
  'bam',
  'bbd',
  'bdt',
  'bif',
  'bmd',
  'bnd',
  'bob',
  'brl',
  'bsd',
  'bwp',
  'bzd',
  'cad',
  'cdf',
  'chf',
  'clp',
  'cny',
  'cop',
  'crc',
  'cve',
  'czk',
  'djf',
  'dkk',
  'dop',
  'dzd',
  'egp',
  'etb',
  'eur',
  'fjd',
  'fkp',
  'gbp',
  'gel',
  'gip',
  'gmd',
  'gnf',
  'gtq',
  'gyd',
  'hkd',
  'hnl',
  'htg',
  'huf',
  'idr',
  'ils',
  'inr',
  'isk',
  'jmd',
  'jpy',
  'kes',
  'kgs',
  'khr',
  'kmf',
  'krw',
  'kyd',
  'kzt',
  'lak',
  'lkr',
  'lrd',
  'lsl',
  'mad',
  'mdl',
  'mga',
  'mkd',
  'mnt',
  'mop',
  'mur',
  'mvr',
  'mwk',
  'mxn',
  'myr',
  'mzn',
  'nad',
  'ngn',
  'nio',
  'nok',
  'npr',
  'nzd',
  'pab',
  'pen',
  'pgk',
  'php',
  'pkr',
  'pln',
  'pyg',
  'qar',
  'ron',
  'rsd',
  'rwf',
  'sar',
  'sbd',
  'scr',
  'sek',
  'sgd',
  'shp',
  'sos',
  'srd',
  'szl',
  'thb',
  'tjs',
  'top',
  'try',
  'ttd',
  'twd',
  'tzs',
  'uah',
  'ugx',
  'usd',
  'uyu',
  'uzs',
  'vnd',
  'vuv',
  'wst',
  'xaf',
  'xcd',
  'xcg',
  'xof',
  'xpf',
  'yer',
  'zar',
  'zmw',
])

export type Currency = typeof Currency.Type

/** How many units the amount is charged for: a power of ten, 1 for a plain amount. */
export type Scale =
  | 1
  | 10
  | 100
  | 1_000
  | 10_000
  | 100_000
  | 1_000_000
  | 10_000_000
  | 100_000_000
  | 1_000_000_000
  | 10_000_000_000
  | 100_000_000_000
  | 1_000_000_000_000

/**
 * An amount in the currency's smallest unit (cents for USD), charged for
 * every `per` units. Only metered prices accept a `per` above 1, since the
 * resulting per-unit rate can be a fraction of a cent.
 */
export interface Money<Per extends Scale = Scale> {
  readonly currency: Currency
  readonly amount: number
  readonly per: Per
}

// Mirrors `_ZERO_DECIMAL_CURRENCIES` in server/polar/kit/currency.py.
const zeroDecimalCurrencies = [
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
] as const satisfies ReadonlyArray<Currency>

type Decimals<Code extends Currency> =
  Code extends (typeof zeroDecimalCurrencies)[number] ? 0 : 2

export const decimalsOf = <Code extends Currency>(code: Code): Decimals<Code> =>
  ((zeroDecimalCurrencies as ReadonlyArray<Currency>).includes(code)
    ? 0
    : 2) as Decimals<Code>

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

interface Fraction {
  0: never
  2: Digit | `${Digit}${Digit}`
}

/**
 * Accepts a literal with at most as many decimals as the currency has, so
 * `usd(0.381)` and `jpy(1.5)` fail to compile. A plain `number` passes and
 * is checked when the amount is created.
 */
export type MajorAmount<
  Amount extends number,
  Code extends Currency,
> = number extends Amount
  ? Amount
  : `${Amount}` extends `-${string}`
    ? `Amounts in ${Code} can't be negative`
    : `${Amount}` extends `${bigint}` | `${bigint}.${Fraction[Decimals<Code>]}`
      ? Amount
      : Decimals<Code> extends 0
        ? `Amounts in ${Code} are whole numbers`
        : `Amounts in ${Code} have at most ${Decimals<Code>} decimals`

/** Shifts the decimal point of a whole amount `decimals` places to the left. */
const shift = (amount: number, decimals: number): string => {
  const digits = String(amount).padStart(decimals + 1, '0')
  const whole = digits.slice(0, digits.length - decimals)
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}

/** Converts an amount in the smallest unit to the currency's major unit: 999 is "9.99" in USD. */
export const majorAmount = (currency: Currency, amount: number): string =>
  shift(amount, decimalsOf(currency))

/** Amounts are in the currency's major unit: `usd(1)` is $1.00, `usd(0.5)` is $0.50. */
export const currency =
  <const Code extends Currency>(code: Code) =>
  <const Amount extends number>(
    amount: MajorAmount<Amount, Code>,
  ): Money<1> => {
    const decimals = decimalsOf(code)
    const match = /^(\d+)(?:\.(\d+))?$/.exec(String(amount))
    const [, whole = '', fraction = ''] = match ?? []
    if (match === null || fraction.length > decimals) {
      throw new Error(
        decimals === 0
          ? `Amounts in ${code} must be non-negative whole numbers, got ${code}(${amount}).`
          : `Amounts in ${code} must be non-negative with at most ${decimals} decimals, got ${code}(${amount}).`,
      )
    }
    return {
      currency: code,
      amount: Number(`${whole}${fraction.padEnd(decimals, '0')}`),
      per: 1,
    }
  }

export const usd = currency('usd')
export const eur = currency('eur')
/** Turkish lira: `try` is a reserved word. */
export const lira = currency('try')
export const gbp = currency('gbp')
export const ils = currency('ils')
export const inr = currency('inr')
export const aud = currency('aud')
export const cad = currency('cad')
export const jpy = currency('jpy')
export const chf = currency('chf')
export const krw = currency('krw')
export const brl = currency('brl')

/**
 * Charges the amount for every `units` units, a power of ten up to 10¹²,
 * e.g. `per(1_000_000_000, usd(0.75))` is $0.75 per billion.
 */
export const per = <const Per extends Exclude<Scale, 1>>(
  units: Per,
  money: Money<1>,
): Money<Per> => ({ ...money, per: units })

/** Charges the amount for every thousand units, e.g. `perThousand(usd(1))` is $1 per 1K. */
export const perThousand = (money: Money<1>): Money<1_000> => per(1_000, money)

/** Charges the amount for every million units, e.g. `perMillion(usd(1))` is $1 per 1M. */
export const perMillion = (money: Money<1>): Money<1_000_000> =>
  per(1_000_000, money)

/**
 * Splits a decimal rate into a whole amount and the number of units it's
 * charged per. Scales in steps of a thousand ("0.0000075" is 7500 per
 * billion) unless that would overflow, then by the exact number of decimals.
 */
export const scaleRate = (
  rate: string,
): { readonly amount: number; readonly per: Scale } => {
  const [whole = '', padded = ''] = rate.split('.')
  const fraction = padded.replace(/0+$/, '')
  const scale = (decimals: number) => ({
    amount: Number(`${whole}${fraction.padEnd(decimals, '0')}`),
    per: (10 ** decimals) as Scale,
  })
  const stepped = scale(Math.ceil(fraction.length / 3) * 3)
  return Number.isSafeInteger(stepped.amount) ? stepped : scale(fraction.length)
}

/** A rate in the smallest currency unit, with the API's 12 decimal places. */
export const DecimalAmount = Schema.String.check(
  Schema.isPattern(/^\d+(\.\d{1,12})?$/),
  Schema.makeFilter((rate) =>
    Number.isSafeInteger(scaleRate(rate).amount)
      ? undefined
      : `The rate ${rate} has too many digits to write as whole amounts.`,
  ),
)

export const WholeAmount = Schema.String.check(Schema.isPattern(/^\d+$/))

/** The per-unit rate as a decimal string, so sub-cent rates keep their precision. */
export const unitAmount = ({ currency, amount, per }: Money): string => {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(
      `Amounts must be non-negative integers in the currency's smallest unit, got ${currency}(${amount}).`,
    )
  }
  if (!/^10*$/.test(String(per)) || per > 1_000_000_000_000) {
    throw new Error(
      `Amounts can only be charged per a power of ten up to 10^12, got ${per}.`,
    )
  }
  return shift(amount, String(per).length - 1)
}
