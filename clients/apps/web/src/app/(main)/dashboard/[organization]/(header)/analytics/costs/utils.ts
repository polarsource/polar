import { toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { endOfToday, subMonths } from 'date-fns'

export const DEFAULT_INTERVAL: schemas['TimeInterval'] = 'day'

export const getDefaultStartDate = () => toISODate(subMonths(endOfToday(), 1))
export const getDefaultEndDate = () => toISODate(endOfToday())

export const getCostsSearchParams = (
  startDate: string,
  endDate: string,
  interval: string,
  customerIds: string[] = [],
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
  if (customerIds.length > 0) {
    customerIds.forEach((id) => params.append('customerIds', id))
  }
  return params.toString()
}
