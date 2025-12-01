import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { endOfToday, subMonths } from 'date-fns'

export const DEFAULT_INTERVAL: schemas['TimeInterval'] = 'day'

export const getDefaultStartDate = () => toISODate(subMonths(endOfToday(), 1))
export const getDefaultEndDate = () => toISODate(endOfToday())

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

export const getCostsSearchParams = (
  startDate: string,
  endDate: string,
  interval: string,
): string => {
  const params = new URLSearchParams()
  if (startDate !== getDefaultStartDate()) {
    params.set('startDate', startDate)
  }
  if (endDate !== getDefaultEndDate()) {
    params.set('endDate', endDate)
  }
  if (interval !== DEFAULT_INTERVAL) {
    params.set('interval', interval)
  }
  return params.toString()
}
