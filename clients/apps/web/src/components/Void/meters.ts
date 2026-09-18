import { ParsedMetricPeriod, ParsedMetricsResponse } from '@/hooks/queries'
import { formatCurrency } from '@polar-sh/currency'
import { subDays } from 'date-fns'
import { VoidDeploy, activeDeploy } from './api'
import { METERS, ROOTS } from './fixtures'
import { dailySeriesFor } from './generators'
import { VoidMeterRecord, VoidReducerMetric } from './identityLive'

export interface VoidMeterReducerRef {
  id: string
  slug: string
}

export interface VoidMeterSeries {
  total: number
  allTime: number
  periods: { timestamp: string; value: number | null }[]
}

export interface VoidMeterConsumer {
  id: string
  name: string
  units: number
}

export interface VoidMeterRow extends VoidMeterRecord {
  units: number
  billed: number
}

export interface VoidMeterDetail extends VoidMeterRow {
  credits: number
  usage: VoidMeterSeries
  consumers: VoidMeterConsumer[]
  usageReducer: VoidMeterReducerRef
  creditReducer: VoidMeterReducerRef
}

const CREATED = '2026-03-01T00:00:00.000Z'
const VERSION = 'main'
const DAYS = 30

const FIXTURE_META: Record<
  string,
  { slug: string; unit_amount: string; reducer: string }
> = {
  meter_1: {
    slug: 'output-tokens',
    unit_amount: '0.003',
    reducer: 'output_tokens',
  },
  meter_2: {
    slug: 'input-tokens',
    unit_amount: '0.0005',
    reducer: 'input_tokens',
  },
  meter_3: { slug: 'tool-calls', unit_amount: '0.1', reducer: 'tool_calls' },
  meter_4: {
    slug: 'sandbox-minutes',
    unit_amount: '2',
    reducer: 'sandbox_minutes',
  },
}

const seeded = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

export const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )

export const meterHref = (base: string, id: string) =>
  `${base}/definition/meters/${encodeURIComponent(id)}`

export const reducerHref = (base: string, id: string) =>
  `${base}/definition/reducers/${encodeURIComponent(id)}`

export const billedCents = (
  units: number,
  meter: Pick<VoidMeterRecord, 'unit_amount'>,
) => Math.round(units * Number(meter.unit_amount) * 100)

export const formatBilled = (cents: number, currency = 'usd') =>
  formatCurrency('statistics')(cents, currency)

export const formatUnitPrice = (
  meter: Pick<VoidMeterRecord, 'unit_amount' | 'currency'>,
) => formatCurrency('subcent')(Number(meter.unit_amount) * 100, meter.currency)

export const metersOfActive = (
  meters: VoidMeterRecord[],
  deploys: VoidDeploy[],
): VoidMeterRecord[] => {
  const active = activeDeploy(deploys)
  if (!active) return meters
  return meters.filter((meter) => meter.version_id === active.version_id)
}

export const rowsOf = (
  meters: VoidMeterRecord[],
  metrics: VoidReducerMetric[],
): VoidMeterRow[] => {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]))
  return meters
    .map((meter) => {
      const units = byId.get(meter.usage_reducer_id)?.total ?? 0
      return { ...meter, units, billed: billedCents(units, meter) }
    })
    .toSorted((a, b) => b.billed - a.billed || b.units - a.units)
}

export const meterSeriesToChart = (
  series: VoidMeterSeries,
  name: string,
): ParsedMetricsResponse => ({
  metrics: {
    orders: { slug: 'orders', display_name: name, type: 'scalar' },
  },
  totals: { orders: series.total },
  periods: series.periods.map((period) => ({
    timestamp: new Date(period.timestamp),
    orders: period.value ?? 0,
  })) as ParsedMetricPeriod[],
})

const consumersFor = (units: number): VoidMeterConsumer[] => {
  const roots = ROOTS.filter(([, , spend]) => spend > 0)
  const total = roots.reduce((sum, [, , spend]) => sum + spend, 0) || 1
  return roots.slice(0, 6).map(([name, , spend], index) => ({
    id: `ident_${index + 1}`,
    name,
    units: Math.round((units * spend) / total),
  }))
}

const seriesFor = (
  total: number,
  allTime: number,
  random: () => number,
): VoidMeterSeries => {
  const values = dailySeriesFor(total, random)
  const end = new Date()
  return {
    total,
    allTime,
    periods: values.map((value, day) => ({
      timestamp: startOfUtcDay(subDays(end, DAYS - 1 - day)).toISOString(),
      value,
    })),
  }
}

const random = seeded(20260918)

export const FIXTURE_METER_DETAILS: VoidMeterDetail[] = METERS.map(
  (meter, index) => {
    const meta = FIXTURE_META[meter.id] ?? {
      slug: meter.id,
      unit_amount: '0.001',
      reducer: `meter_${index + 1}`,
    }
    const usageReducer = {
      id: `reducer_${index + 1}`,
      slug: meta.reducer,
    }
    const allTime = Math.round(meter.units * 3.4)
    return {
      id: meter.id,
      name: meter.name,
      slug: meta.slug,
      version_id: VERSION,
      usage_reducer_id: usageReducer.id,
      credit_reducer_id: `credit_${index + 1}`,
      unit_amount: meta.unit_amount,
      currency: 'usd',
      created_at: CREATED,
      units: meter.units,
      billed: meter.billed,
      credits: Math.round(meter.units * 1.12),
      usage: seriesFor(meter.units, allTime, random),
      consumers: consumersFor(meter.units),
      usageReducer,
      creditReducer: {
        id: `credit_${index + 1}`,
        slug: `${usageReducer.slug}_credits`,
      },
    }
  },
)
