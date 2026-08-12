'use client'

import { getNextValidInterval } from '@/components/Metrics/IntervalPicker'
import { getCustomerActivityStart } from '@/utils/customer'
import { useDateRange } from '@/utils/date'
import { schemas } from '@polar-sh/client'
import { endOfToday, startOfDay } from 'date-fns'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useMemo } from 'react'

export const CUSTOMER_METRICS_QUERY_PARAMS = [
  'startDate',
  'endDate',
  'interval',
]

/**
 * Date range and interval for the customer detail pages, backed by query
 * params so the selection survives navigation between the subroutes.
 */
export const useCustomerMetricsParams = (customer: schemas['Customer']) => {
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange({
    defaultStartDate: startOfDay(getCustomerActivityStart(customer)),
    defaultEndDate: endOfToday(),
  })

  const [intervalParam, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as schemas['TimeInterval'][]),
  )

  const interval: schemas['TimeInterval'] = getNextValidInterval(
    intervalParam ?? 'day',
    startDate,
    endDate,
  )

  const dateRange = useMemo(
    () => ({ startDate, endDate }),
    [startDate, endDate],
  )

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    interval,
    setInterval,
    dateRange,
  }
}
