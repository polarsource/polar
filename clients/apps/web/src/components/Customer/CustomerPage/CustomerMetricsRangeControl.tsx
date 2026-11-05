'use client'

import { getCustomerActivityStart } from '@/utils/customer'
import { CHART_RANGES, ChartRange, dateRangeToInterval } from '@/utils/metrics'
import { getMetricsRangeDates, schemas } from '@polar-sh/client'
import { SegmentedControl } from '@polar-sh/orbit'
import { endOfToday, isSameDay, startOfDay } from 'date-fns'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

const RANGE_OPTIONS = (
  Object.entries(CHART_RANGES) as [ChartRange, string][]
).map(([value, label]) => ({ value, label }))

const getRangeDates = (range: ChartRange, customer: schemas['Customer']) => {
  const [startDate] = getMetricsRangeDates(range, {
    createdAt: getCustomerActivityStart(customer),
  })
  return { startDate: startOfDay(startDate), endDate: endOfToday() }
}

export const CustomerMetricsRangeControl = ({
  customer,
}: {
  customer: schemas['Customer']
}) => {
  const { startDate, endDate, setStartDate, setEndDate, setInterval } =
    useCustomerMetricsParams(customer)

  const activeRange =
    RANGE_OPTIONS.find(({ value }) => {
      const range = getRangeDates(value, customer)
      return (
        isSameDay(range.startDate, startDate) &&
        isSameDay(range.endDate, endDate)
      )
    })?.value ?? 'custom'

  const selectRange = (range: ChartRange | 'custom') => {
    if (range === 'custom') return
    const { startDate, endDate } = getRangeDates(range, customer)
    setStartDate(startDate)
    setEndDate(endDate)
    setInterval(dateRangeToInterval(startDate, endDate))
  }

  return (
    <SegmentedControl<ChartRange | 'custom'>
      options={RANGE_OPTIONS}
      value={activeRange}
      onChange={selectRange}
    />
  )
}
