import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'

export const getSearchParams = (
  dateRange: { from: Date; to: Date },
  interval: schemas['TimeInterval'],
) => {
  const params = new URLSearchParams()
  params.set('startDate', toISODate(dateRange.from))
  params.set('endDate', toISODate(dateRange.to))
  params.set('interval', interval)
  return params.toString()
}
