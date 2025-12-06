'use client'

import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import ProductSelect from '@/components/Products/ProductSelect'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns/subMonths'
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useCallback, useMemo } from 'react'

const TIME_INTERVALS = ['hour', 'day', 'week', 'month', 'year'] as const

// Custom parser for YYYY-MM-DD date format
const parseAsISODate = createParser({
  parse: (value) => {
    if (!value) return null
    const date = fromISODate(value)
    return isNaN(date.getTime()) ? null : date
  },
  serialize: (date) => toISODate(date),
})

interface MetricsHeaderProps {
  organization: schemas['Organization']
  earliestDateISOString: string
}

export function MetricsHeader({
  organization,
  earliestDateISOString,
}: MetricsHeaderProps) {
  const minDate = useMemo(
    () => fromISODate(earliestDateISOString),
    [earliestDateISOString],
  )

  const defaultStartDate = useMemo(() => subMonths(new Date(), 1), [])
  const defaultEndDate = useMemo(() => new Date(), [])

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

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      setInterval(newInterval)
    },
    [setInterval],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const validInterval = getNextValidInterval(
        interval,
        dateRange.from,
        dateRange.to,
      )
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
      setInterval(validInterval)
    },
    [interval, setStartDate, setEndDate, setInterval],
  )

  const onProductSelect = useCallback(
    (value: string[]) => {
      setProductId(value.length > 0 ? value : null)
    },
    [setProductId],
  )

  return (
    <div className="flex flex-col items-center gap-2 lg:flex-row">
      <div className="w-full lg:w-auto">
        <IntervalPicker
          interval={interval}
          onChange={onIntervalChange}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      <div className="w-full lg:w-auto">
        <DateRangePicker
          date={dateRange}
          onDateChange={onDateChange}
          minDate={minDate}
          className="w-full"
        />
      </div>
      <div className="w-full lg:w-auto">
        <ProductSelect
          organization={organization}
          value={productId ?? []}
          onChange={onProductSelect}
          className="w-auto"
        />
      </div>
    </div>
  )
}
