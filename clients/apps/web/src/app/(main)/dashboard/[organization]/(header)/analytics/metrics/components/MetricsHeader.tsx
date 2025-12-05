'use client'

import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import ProductSelect from '@/components/Products/ProductSelect'
import { fromISODate, toISODate } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import { subMonths } from 'date-fns/subMonths'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

interface MetricsHeaderProps {
  organization: schemas['Organization']
  earliestDateISOString: string
  startDateISOString?: string
  endDateISOString?: string
  interval: schemas['TimeInterval']
  productId?: string[]
}

export function MetricsHeader({
  organization,
  earliestDateISOString,
  startDateISOString,
  endDateISOString,
  interval,
  productId,
}: MetricsHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  const minDate = useMemo(
    () => fromISODate(earliestDateISOString),
    [earliestDateISOString],
  )

  const [startDate, endDate] = useMemo(() => {
    const today = new Date()
    const startDate = startDateISOString
      ? fromISODate(startDateISOString)
      : subMonths(today, 1)
    const endDate = endDateISOString ? fromISODate(endDateISOString) : today
    return [startDate, endDate]
  }, [startDateISOString, endDateISOString])

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const getSearchParams = (
    dateRange: { from: Date; to: Date },
    interval: schemas['TimeInterval'],
    productId?: string[],
  ) => {
    const params = new URLSearchParams()
    params.append('start_date', toISODate(dateRange.from))
    params.append('end_date', toISODate(dateRange.to))
    params.append('interval', interval)

    if (productId) {
      productId.forEach((id) => params.append('product_id', id))
    }

    return params
  }

  const onIntervalChange = useCallback(
    (newInterval: schemas['TimeInterval']) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        newInterval,
        productId,
      )
      router.push(`${pathname}?${params}`)
    },
    [router, pathname, startDate, endDate, productId],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const validInterval = getNextValidInterval(
        interval,
        dateRange.from,
        dateRange.to,
      )
      const params = getSearchParams(dateRange, validInterval, productId)
      router.push(`${pathname}?${params}`)
    },
    [router, pathname, interval, productId],
  )

  const onProductSelect = useCallback(
    (value: string[]) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        value,
      )
      router.push(`${pathname}?${params}`)
    },
    [router, pathname, interval, startDate, endDate],
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
          value={productId || []}
          onChange={onProductSelect}
          className="w-auto"
        />
      </div>
    </div>
  )
}
