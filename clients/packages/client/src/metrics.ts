import { startOfDay, subDays, subMonths, subYears } from 'date-fns'

export type MetricsRange = '24h' | '30d' | '3m' | '12m' | 'today' | 'all_time'

export const getMetricsRangeDates = (
  range: MetricsRange,
  options?: {
    createdAt?: string | Date
    now?: Date
  },
): [Date, Date] => {
  const endDate = options?.now ?? new Date()

  switch (range) {
    case '24h':
      return [subDays(endDate, 1), endDate]
    case '30d':
      // 29 (not 30) so the inclusive day buckets returned by the metrics API
      // span exactly 30 days, today included.
      return [subDays(endDate, 29), endDate]
    case '3m':
      return [subMonths(endDate, 3), endDate]
    case '12m':
      return [subYears(endDate, 1), endDate]
    case 'today':
      return [startOfDay(endDate), endDate]
    case 'all_time':
      if (!options?.createdAt) {
        throw new Error('createdAt is required for all_time metrics range')
      }
      return [new Date(options.createdAt), endDate]
  }
}
