'use client'

import { fromISODate, toISODate } from '@/utils/metrics'
import { getMetricsRangeDates } from '@polar-sh/client'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'

const TIME_INTERVALS = ['hour', 'day', 'week', 'month', 'year'] as const

const parseAsISODate = createParser({
  parse: (value: string) => {
    if (!value) return null
    const date = fromISODate(value)
    return isNaN(date.getTime()) ? null : date
  },
  serialize: (date: Date) => toISODate(date),
})

export function useMetricsFilters(earliestDateISOString: string) {
  const minDate = useMemo(
    () => fromISODate(earliestDateISOString),
    [earliestDateISOString],
  )
  const [defaultStartDate, defaultEndDate] = useMemo(
    () => getMetricsRangeDates('30d'),
    [],
  )

  const [interval, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral(TIME_INTERVALS).withDefault('day'),
  )
  const [startDate, setStartDate] = useQueryState(
    'start_date',
    parseAsISODate.withDefault(defaultStartDate),
  )
  const [endDate, setEndDate] = useQueryState(
    'end_date',
    parseAsISODate.withDefault(defaultEndDate),
  )
  const [productId, setProductId] = useQueryState(
    'product_id',
    parseAsArrayOf(parseAsString),
  )

  return {
    interval,
    setInterval,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    productId,
    setProductId,
    minDate,
  }
}
