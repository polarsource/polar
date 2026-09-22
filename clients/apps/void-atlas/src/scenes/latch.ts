import type { Ir } from '@void/sdk/config'

export type IrSignal = NonNullable<Ir['signals']>[number]
export type IrMeterSignal = Extract<IrSignal, { kind: 'meter' }>
export type IrSemanticSignal = Extract<IrSignal, { kind: 'semantic' }>

/**
 * The SDK's hysteresis latch, as `runtime/signals.ts` implements it. A meter
 * signal enters strictly below `enter_below` and exits at or above
 * `exit_at_least`; a semantic signal enters strictly above `enter_above` and
 * exits strictly below `exit_below`. An unknown observation (no balance, no
 * answer) keeps the last latched condition and publishes `unknown`.
 */

export type Status = 'active' | 'inactive' | 'unknown'
export type Transition = 'entered' | 'exited' | null

export interface Observation {
  readonly index: number
  readonly value: number | null
  readonly status: Status
  readonly transition: Transition
}

const classifyMeter = (
  value: number | null,
  active: boolean,
  ref: IrMeterSignal,
): Status => {
  if (value === null || !Number.isFinite(value)) return 'unknown'
  if (active) return value >= ref.exit_at_least ? 'inactive' : 'active'
  return value < ref.enter_below ? 'active' : 'inactive'
}

const classifySemantic = (
  value: number | null,
  active: boolean,
  ref: IrSemanticSignal,
): Status => {
  if (value === null || !Number.isFinite(value)) return 'unknown'
  if (active) return value < ref.exit_below ? 'inactive' : 'active'
  return value > ref.enter_above ? 'active' : 'inactive'
}

/** Folds a series of observed values through the latch, from a fresh client. */
export const latch = (
  signal: IrSignal,
  values: readonly (number | null)[],
  initialStatus: 'active' | 'inactive' = 'inactive',
): Observation[] => {
  let active = initialStatus === 'active'
  return values.map((value, index) => {
    const status =
      signal.kind === 'meter'
        ? classifyMeter(value, active, signal)
        : classifySemantic(value, active, signal)
    let transition: Transition = null
    if (status === 'active' && !active) transition = 'entered'
    if (status === 'inactive' && active) transition = 'exited'
    if (status !== 'unknown') active = status === 'active'
    return { index, value, status, transition }
  })
}

export const thresholds = (signal: IrSignal) =>
  signal.kind === 'meter'
    ? {
        enter: signal.enter_below,
        exit: signal.exit_at_least,
        direction: 'below' as const,
      }
    : {
        enter: signal.enter_above,
        exit: signal.exit_below,
        direction: 'above' as const,
      }
