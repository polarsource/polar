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
      return [subDays(endDate, 30), endDate]
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
