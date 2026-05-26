import { useLocalStorage } from '@/hooks/useLocalStorage'
import { CHART_RANGES, ChartRange } from '@/utils/metrics'
import { useCallback } from 'react'

const VALID_RANGES = new Set<ChartRange>(
  Object.keys(CHART_RANGES) as ChartRange[],
)

const DEFAULT_RANGE: ChartRange = '30d'

const storageKey = (orgId: string) => `overview_chart_range:${orgId}`

const isValidRange = (value: unknown): value is ChartRange =>
  typeof value === 'string' && VALID_RANGES.has(value as ChartRange)

// Identity serialise/deserialise so existing raw-string values
// (`30d`, `12m`, …) in localStorage stay readable across the migration.
const serialize = (value: ChartRange): string => value
const deserialize = (raw: string): ChartRange => raw as ChartRange

export const useChartRange = (orgId: string) => {
  const [range, setRange] = useLocalStorage<ChartRange>(
    storageKey(orgId),
    DEFAULT_RANGE,
    { validate: isValidRange, serialize, deserialize },
  )

  // Match the old return shape — `setRange` is the same setter, kept named
  // here for clarity.
  const updateRange = useCallback(
    (next: ChartRange) => setRange(next),
    [setRange],
  )

  return { range, setRange: updateRange }
}
