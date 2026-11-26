'use client'

import type { MetricsProductFilter } from '@/hooks/queries/metrics'
import { fromISODate, parseAsISODate, TIME_INTERVALS } from '@/utils/metrics'
import { getMetricsRangeDates } from '@polar-sh/client'
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useMemo } from 'react'

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
  const [externalProductId, setExternalProductId] = useQueryState(
    'external_product_id',
    parseAsArrayOf(parseAsString),
  )
  const productFilter: MetricsProductFilter = {
    ...(productId?.length ? { product_id: productId } : {}),
    ...(externalProductId?.length
      ? { external_product_id: externalProductId }
      : {}),
  }

  return {
    interval,
    setInterval,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    productId,
    setProductId,
    externalProductId,
    setExternalProductId,
    productFilter,
    minDate,
  }
}
