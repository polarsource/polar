import { CHART_RANGES, ChartRange } from '@/utils/metrics'
import { useCallback, useState } from 'react'

const VALID_RANGES = new Set<ChartRange>(
  Object.keys(CHART_RANGES) as ChartRange[],
)

const storageKey = (orgId: string) => `overview_chart_range:${orgId}`

const readRange = (orgId: string): ChartRange => {
  try {
    const stored = localStorage.getItem(storageKey(orgId))
    if (stored && VALID_RANGES.has(stored as ChartRange)) {
      return stored as ChartRange
    }
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
  return '30d'
}

export const useChartRange = (orgId: string) => {
  const [range, setRange] = useState<ChartRange>(() => readRange(orgId))

  const handleRangeChange = useCallback(
    (next: ChartRange) => {
      setRange(next)
      try {
        localStorage.setItem(storageKey(orgId), next)
      } catch {
        // ignore
      }
    },
    [orgId],
  )

  return { range, setRange: handleRangeChange }
}
