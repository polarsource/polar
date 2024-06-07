'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DateRangePicker from '@/components/Metrics/DateRangePicker'
import IntervalPicker from '@/components/Metrics/IntervalPicker'
import MetricChartBox from '@/components/Metrics/MetricChartBox'
import ProductSelect, {
  ProductSelectType,
} from '@/components/Products/ProductSelect'
import { useProductsByPriceType } from '@/hooks/products'
import { useMetrics } from '@/hooks/queries'
import { toISODate } from '@/utils/metrics'
import {
  Interval,
  MetricPeriod,
  Organization,
  ProductPriceType,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export default function ClientPage({
  organization,
  startDate,
  endDate,
  interval,
  productId,
  productPriceType,
  focus,
}: {
  organization: Organization
  startDate: Date
  endDate: Date
  interval: Interval
  productId?: string
  productPriceType?: ProductPriceType
  focus: keyof Omit<MetricPeriod, 'timestamp'>
}) {
  const router = useRouter()
  const productsByPriceType = useProductsByPriceType(organization.id)

  const { data } = useMetrics({
    startDate,
    endDate,
    interval,
    organizationId: organization.id,
    productId,
    productPriceType,
  })

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const getSearchParams = (
    dateRange: { from: Date; to: Date },
    interval: Interval,
    focus: keyof Omit<MetricPeriod, 'timestamp'>,
    productId?: string,
    productPriceType?: ProductPriceType,
  ) => {
    const params = new URLSearchParams()
    params.append('start_date', toISODate(dateRange.from))
    params.append('end_date', toISODate(dateRange.to))
    params.append('interval', interval)
    params.append('focus', focus)

    if (productId) {
      params.append('product_id', productId)
    } else if (productPriceType) {
      params.append('product_price_type', productPriceType)
    }

    return params
  }

  const onIntervalChange = useCallback(
    (interval: Interval) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
        productId,
        productPriceType,
      )
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [
      router,
      organization,
      startDate,
      endDate,
      focus,
      productId,
      productPriceType,
    ],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      const params = getSearchParams(
        dateRange,
        interval,
        focus,
        productId,
        productPriceType,
      )
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [router, organization, interval, focus, productId, productPriceType],
  )

  const productSelectValue = useMemo(() => {
    if (productId) {
      return { productId }
    } else if (productPriceType) {
      return { productPriceType }
    }
    return undefined
  }, [productId, productPriceType])

  const onProductSelect = useCallback(
    (value: ProductSelectType | undefined) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
        value && 'productId' in value ? value.productId : undefined,
        value && 'productPriceType' in value
          ? value.productPriceType
          : undefined,
      )
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [router, organization, interval, startDate, endDate, focus],
  )

  const onFocusChange = useCallback(
    (focus: keyof Omit<MetricPeriod, 'timestamp'>) => {
      const params = getSearchParams(
        { from: startDate, to: endDate },
        interval,
        focus,
        productId,
        productPriceType,
      )
      router.push(`/maintainer/${organization.name}/sales/overview?${params}`)
    },
    [
      router,
      organization,
      startDate,
      endDate,
      interval,
      productId,
      productPriceType,
    ],
  )

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-2 lg:flex-row">
          <div className="w-full lg:w-1/6">
            <IntervalPicker interval={interval} onChange={onIntervalChange} />
          </div>
          <div className="w-full lg:w-1/4">
            <DateRangePicker
              date={dateRange}
              onDateChange={onDateChange}
              className="w-full"
            />
          </div>
          <div className="w-full lg:w-1/6">
            <ProductSelect
              productsByPriceType={productsByPriceType}
              value={productSelectValue}
              onChange={onProductSelect}
            />
          </div>
        </div>
        {data && (
          <>
            <div>
              <MetricChartBox
                data={data.periods}
                interval={interval}
                metric={data.metrics[focus]}
                height={300}
                maxTicks={10}
                focused={true}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {Object.values(data.metrics)
                .filter((metric) => metric.slug !== focus)
                .map((metric) => (
                  <div key={metric.slug}>
                    <MetricChartBox
                      key={metric.slug}
                      data={data.periods}
                      interval={interval}
                      metric={metric}
                      height={150}
                      maxTicks={5}
                      focused={false}
                      onFocus={() => onFocusChange(metric.slug)}
                    />
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </DashboardBody>
  )
}
