import { VoidConfigSignal } from './api'
import { describeHysteresis, formatMeterValue, formatNoul } from './signals'

export interface ThresholdRow {
  key: string
  value: string
  effect: string
}

export const signalThresholds = (signal: VoidConfigSignal): ThresholdRow[] =>
  signal.kind === 'meter'
    ? [
        {
          key: 'meter',
          value: signal.meter,
          effect: 'The meter whose remaining balance the thresholds read.',
        },
        {
          key: 'enter.below',
          value: formatMeterValue(signal.enter_below),
          effect: 'Becomes active once remaining drops below this.',
        },
        {
          key: 'exit.atLeast',
          value: formatMeterValue(signal.exit_at_least),
          effect: describeHysteresis(signal),
        },
      ]
    : [
        {
          key: 'meter',
          value: signal.meter,
          effect: 'The meter whose recent events Jev reads.',
        },
        {
          key: 'when',
          value: signal.when,
          effect: 'The question Jev answers with a noul, verbatim.',
        },
        {
          key: 'over',
          value: `recent(${signal.over.amount}, '${signal.over.unit}')`,
          effect: 'How far back the events go.',
        },
        {
          key: 'enter.above',
          value: formatNoul(signal.enter_above),
          effect: 'Becomes active once the noul rises above this.',
        },
        {
          key: 'exit.below',
          value: formatNoul(signal.exit_below),
          effect: describeHysteresis(signal),
        },
      ]

const camel = (slug: string) =>
  slug.replace(/[-_]+([a-z0-9])/g, (_, char: string) => char.toUpperCase())

const quote = (value: string) =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** Mirrors the SDK's `toSource` output for one signal (void-sdk/src/config/codegen.ts). */
export const signalDefinition = (signal: VoidConfigSignal): string => {
  const lines =
    signal.kind === 'meter'
      ? [
          `meter: ${camel(signal.meter)},`,
          `field: 'remaining',`,
          `enter: { below: ${signal.enter_below} },`,
          `exit: { atLeast: ${signal.exit_at_least} },`,
        ]
      : [
          `meter: ${camel(signal.meter)},`,
          `when: ${quote(signal.when)},`,
          ...(signal.over.amount === 1 && signal.over.unit === 'hour'
            ? []
            : [`over: recent(${signal.over.amount}, '${signal.over.unit}'),`]),
          `enter: { above: ${signal.enter_above} },`,
          `exit: { below: ${signal.exit_below} },`,
        ]
  return `export const ${camel(signal.slug)} = signal(${quote(signal.slug)}, {\n  ${lines.join('\n  ')}\n})`
}

export const signalUsage = (signal: VoidConfigSignal): string => {
  const name = camel(signal.slug)
  const read = signal.kind === 'meter' ? 'state.balance?.remaining' : 'state.noul'
  return `const state = await polar.as(customerId).signals.${name}.get()
state.status // 'active' | 'inactive' | 'unknown'
${read}

polar.as(customerId).signals.${name}.listen((state) => {
  if (state.transition === 'entered') pauseAgent()
  if (state.transition === 'exited') resumeAgent()
})`
}
