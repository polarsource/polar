export type MeterUnit = 'scalar' | 'tokens' | 'bytes' | 'seconds'

export interface MeterUnitFormat {
  /**
   * Factor to multiply unit_amount (in cents) by to get the price at display
   * scale. For example, tokens uses 1_000_000 so "$0.00001/token" becomes
   * "$10 / 1M tokens".
   */
  scale: number
  /** Human-readable denominator shown after the price, e.g. "1M tokens". */
  label: string
}

const UNIT_FORMATS: Record<MeterUnit, MeterUnitFormat> = {
  scalar: { scale: 1, label: 'unit' },
  tokens: { scale: 1_000_000, label: '1M tokens' },
  bytes: { scale: 1_000_000_000, label: 'GB' },
  seconds: { scale: 3_600, label: 'hour' },
}

/**
 * Returns the display scale and unit label for a given meter unit.
 *
 * @example
 * // Tokens: $10 / 1M tokens
 * const { scale, label } = getMeterUnitFormat('tokens')
 * const displayAmount = unitAmountCents * scale  // 0.001 * 1_000_000 = 1000 cents = $10
 *
 * @example
 * // Bytes: $0.023 / GB
 * const { scale, label } = getMeterUnitFormat('bytes')
 * const displayAmount = unitAmountCents * scale  // 0.0000000023 * 1e9 = 2.3 cents = $0.023
 *
 * @example
 * // Seconds: $2.50 / hour
 * const { scale, label } = getMeterUnitFormat('seconds')
 * const displayAmount = unitAmountCents * scale  // (250/3600) * 3600 = 250 cents = $2.50
 */
export function getMeterUnitFormat(unit: MeterUnit): MeterUnitFormat {
  return UNIT_FORMATS[unit] ?? UNIT_FORMATS.scalar
}

export const METER_UNIT_DISPLAY_NAMES: Record<MeterUnit, string> = {
  scalar: 'Scalar',
  tokens: 'Tokens',
  bytes: 'Bytes',
  seconds: 'Seconds',
}
