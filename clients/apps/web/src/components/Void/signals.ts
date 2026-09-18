import { formatPercentage } from '@/utils/formatters'
import { StatusColor } from '@polar-sh/orbit'
import { VoidConfigSignal, VoidConfigSignalWindow } from './api'

export const formatSignalWindow = (over: VoidConfigSignalWindow): string =>
  `${over.amount} ${over.unit}${over.amount === 1 ? '' : 's'}`

export const formatNoul = formatPercentage

export const formatMeterValue = (value: number): string =>
  value.toLocaleString('en-US')

export const SIGNAL_KIND: Record<
  VoidConfigSignal['kind'],
  { label: string; color: StatusColor }
> = {
  meter: { label: 'Meter', color: 'blue' },
  semantic: { label: 'Semantic', color: 'purple' },
}

export const signalEnters = (signal: VoidConfigSignal): string =>
  signal.kind === 'meter'
    ? `below ${formatMeterValue(signal.enter_below)}`
    : `above ${formatNoul(signal.enter_above)}`

export const signalExits = (signal: VoidConfigSignal): string =>
  signal.kind === 'meter'
    ? `at ${formatMeterValue(signal.exit_at_least)}`
    : `below ${formatNoul(signal.exit_below)}`

/** The hysteresis rule in one sentence, shared by the chart caption and the fields table. */
export const describeHysteresis = (signal: VoidConfigSignal): string =>
  signal.kind === 'meter'
    ? `Dropping ${signalEnters(signal)} enters. Only refilling to ${formatMeterValue(signal.exit_at_least)} exits. In between, the previous status holds, so a balance hovering near the limit does not flap.`
    : `Rising ${signalEnters(signal)} enters. Only falling ${signalExits(signal)} exits. In between, the previous status holds, so one borderline answer does not flap the signal.`

export const signalHref = (base: string, slug: string) =>
  `${base}/definition/signals/${encodeURIComponent(slug)}`

export const FIXTURE_SIGNALS: VoidConfigSignal[] = [
  {
    slug: 'low-balance',
    kind: 'meter',
    meter: 'credits',
    enter_below: 100,
    exit_at_least: 500,
  },
  {
    slug: 'retry-storm',
    kind: 'semantic',
    meter: 'tokens',
    when: 'most recent spend is retries or loops, not progress',
    over: { amount: 1, unit: 'hour' },
    enter_above: 0.7,
    exit_below: 0.4,
  },
]
