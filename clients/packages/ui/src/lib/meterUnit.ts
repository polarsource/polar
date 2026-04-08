export type MeterUnit = 'scalar' | 'token' | 'custom'

export interface MeterUnitFormat {
  /**
   * Factor to multiply unit_amount (in cents) by to get the price at display
   * scale. For example, token uses 1_000_000 so "$0.00001/token" becomes
   * "$10 / 1M tokens".
   */
  scale: number
  /** Human-readable denominator shown after the price, e.g. "1M tokens". */
  label: string
}

const UNIT_FORMATS: Record<Exclude<MeterUnit, 'custom'>, MeterUnitFormat> = {
  scalar: { scale: 1, label: 'unit' },
  token: { scale: 1_000_000, label: '1M tokens' },
}

/**
 * Returns the display scale and unit label for a given meter unit.
 *
 * For custom units, pass `customLabel` and `customMultiplier` to override the
 * defaults. Without them, custom units fall back to scalar (scale=1, label="unit").
 *
 * @example
 * // Token: $10 / 1M tokens
 * const { scale, label } = getMeterUnitFormat('token')
 * const displayAmount = unitAmountCents * scale  // 0.001 * 1_000_000 = 1000 cents = $10
 *
 * @example
 * // Custom: $5 / 1000 requests
 * const { scale, label } = getMeterUnitFormat('custom', { customLabel: 'requests', customMultiplier: 1000 })
 * const displayAmount = unitAmountCents * scale  // 0.5 * 1000 = 500 cents = $5
 */
export function getMeterUnitFormat(
  unit: MeterUnit,
  options?: { customLabel?: string | null; customMultiplier?: number | null },
): MeterUnitFormat {
  if (unit === 'custom') {
    return {
      scale: options?.customMultiplier ?? 1,
      label: options?.customLabel ?? 'unit',
    }
  }
  return UNIT_FORMATS[unit] ?? UNIT_FORMATS.scalar
}

export const METER_UNIT_DISPLAY_NAMES: Record<MeterUnit, string> = {
  scalar: 'Scalar',
  token: 'Token',
  custom: 'Custom',
}
