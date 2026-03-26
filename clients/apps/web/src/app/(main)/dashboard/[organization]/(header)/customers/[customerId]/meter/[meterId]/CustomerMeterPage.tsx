'use client'

import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import DateRangePicker, {
  DateRangeInterval,
} from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import FormattedUnits from '@/components/Meter/FormattedUnits'
import MetricChart from '@/components/Metrics/MetricChart'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useInfiniteEvents } from '@/hooks/queries/events'
import { useMeterQuantities } from '@/hooks/queries/meters'
import { Events } from '@/components/Events/Events'
import { ParsedMetricPeriod } from '@/hooks/queries/metrics'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import FormattedInterval from '@polar-sh/ui/components/atoms/FormattedInterval'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { UTCDate } from '@date-fns/utc'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import Link from 'next/link'
import { parseAsIsoDateTime, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useInViewport } from '@/hooks/utils'
import { useCallback, useEffect, useMemo } from 'react'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'

interface CustomerMeterPageProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
  meter: schemas['Meter']
}

const CustomerMeterPage = ({
  organization,
  customer,
  meter,
}: CustomerMeterPageProps) => {
  const [startDateParam, setStartDate] = useQueryState(
    'startDate',
    parseAsIsoDateTime,
  )
  const [endDateParam, setEndDate] = useQueryState(
    'endDate',
    parseAsIsoDateTime,
  )

  const [interval, setInterval] = useQueryState(
    'interval',
    parseAsStringLiteral([
      'hour',
      'day',
      'week',
      'month',
      'year',
    ] as schemas['TimeInterval'][]).withDefault('day'),
  )

  const onDateChange = useCallback(
    (date: { from: Date; to: Date }) => {
      const valid = getNextValidInterval(interval, date.from, date.to)
      setStartDate(date.from)
      setEndDate(date.to)
      if (valid !== interval) setInterval(valid)
    },
    [interval, setStartDate, setEndDate, setInterval],
  )

  const { data: subscriptionsData } = useSubscriptions(organization.id, {
    customer_id: customer.id,
    active: true,
  })

  const subscription = useMemo(
    () =>
      subscriptionsData?.items.find((sub) =>
        sub.meters.some((m) => m.meter_id === meter.id),
      ) ?? null,
    [subscriptionsData, meter.id],
  )

  const { data: customerMetersData } = useCustomerMeters(organization.id, {
    customer_id: customer.id,
    meter_id: meter.id,
  })

  const customerMeter = customerMetersData?.items[0] ?? null

  const billingPeriodInterval = useMemo((): DateRangeInterval | null => {
    if (!subscription?.current_period_end) return null
    return {
      slug: 'currentBillingPeriod',
      label: 'Current Billing Period',
      value: [
        new Date(subscription.current_period_start),
        new Date(subscription.current_period_end),
      ],
    }
  }, [subscription])

  // Derive effective dates: explicit user selection > billing period > this month
  const startDate =
    startDateParam ??
    billingPeriodInterval?.value[0] ??
    startOfMonth(new Date())
  const endDate =
    endDateParam ?? billingPeriodInterval?.value[1] ?? endOfMonth(new Date())

  const { data: quantities } = useMeterQuantities(meter.id, {
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
    interval,
    customer_id: customer.id,
  })

  const unitPrice = useMemo(
    () =>
      subscription?.product.prices.find(
        (p): p is schemas['ProductPriceMeteredUnit'] =>
          p.amount_type === 'metered_unit' && p.meter_id === meter.id,
      ) ?? null,
    [subscription, meter.id],
  )

  const {
    data: eventsData,
    fetchNextPage,
    isFetching,
    hasNextPage,
  } = useInfiniteEvents(organization.id, {
    meter_id: meter.id,
    customer_id: customer.id,
    start_timestamp: startDate.toISOString(),
    end_timestamp: endDate.toISOString(),
  })

  const meterEvents = useMemo(
    () => eventsData?.pages.flatMap((page) => page.items) ?? [],
    [eventsData],
  )

  const { ref: sentinelRef, inViewport } = useInViewport()

  useEffect(() => {
    if (inViewport && hasNextPage && !isFetching) {
      fetchNextPage()
    }
  }, [inViewport, hasNextPage, isFetching, fetchNextPage])

  const overages = useMemo(() => {
    if (!unitPrice || !customerMeter || customerMeter.balance >= 0) return null
    const cost =
      Math.abs(customerMeter.balance) * parseFloat(unitPrice.unit_amount)
    return {
      cost: unitPrice.cap_amount ? Math.min(cost, unitPrice.cap_amount) : cost,
      currency: unitPrice.price_currency,
    }
  }, [customerMeter, unitPrice])

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <div className="flex flex-row items-center gap-4">
            <Link
              href={`/dashboard/${organization.slug}/customers/${customer.id}`}
              className="dark:text-polar-500 shrink-0 text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowBackOutlined fontSize="small" />
            </Link>
            <div className="flex flex-row items-center gap-x-4">
              <p className="truncate text-lg font-medium">{meter.name}</p>
              {subscription && (
                <span className="dark:text-polar-500 text-lg text-gray-500">
                  {subscription.product.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-row gap-6">
            <Link
              href={`/dashboard/${organization.slug}/products/meters/${meter.id}`}
            >
              <Button>View Meter</Button>
            </Link>
            <div className="flex flex-row gap-2">
              <div>
                <IntervalPicker
                  interval={interval}
                  onChange={setInterval}
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
              <DateRangePicker
                date={{ from: startDate, to: endDate }}
                onDateChange={onDateChange}
                additionalIntervals={
                  billingPeriodInterval ? [billingPeriodInterval] : undefined
                }
              />
            </div>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-row items-center gap-6">
          <Avatar
            avatar_url={customer.avatar_url}
            name={customer.display_email}
            className="h-16 w-16"
          />
          <div className="flex flex-col">
            <p className="text-lg">
              {(customer.name?.length ?? 0) > 0 ? customer.name : '—'}
            </p>
            <div className="dark:text-polar-500 flex flex-row items-center text-base font-normal text-gray-500">
              <span>{customer.display_email}</span>
            </div>
          </div>
        </div>
        {customerMeter && (
          <div className="flex flex-row flex-wrap gap-4">
            {subscription?.current_period_end && (
              <StatisticCard title="Current Billing Period">
                <FormattedInterval
                  startDatetime={subscription.current_period_start}
                  endDatetime={subscription.current_period_end}
                />
              </StatisticCard>
            )}
            <StatisticCard title="Consumed">
              <FormattedUnits value={customerMeter.consumed_units} />
            </StatisticCard>
            <StatisticCard title="Credited">
              <FormattedUnits value={customerMeter.credited_units} />
            </StatisticCard>
            <StatisticCard title="Balance">
              <FormattedUnits value={customerMeter.balance} />
            </StatisticCard>
            <StatisticCard title="Overages">
              {overages
                ? formatCurrency('compact')(overages.cost, overages.currency)
                : unitPrice
                  ? formatCurrency('compact')(0, unitPrice.price_currency)
                  : '—'}
            </StatisticCard>
          </div>
        )}
        <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-0 p-2">
          <div className="dark:bg-polar-900 rounded-3xl bg-white p-4">
            <MetricChart
              data={
                (quantities?.quantities ??
                  []) as unknown as ParsedMetricPeriod[]
              }
              interval={interval}
              height={300}
              metric={{
                slug: 'quantity',
                display_name: meter.name,
                type: 'scalar',
              }}
              showYAxis
              chartType={meter.aggregation.func === 'count' ? 'bar' : 'line'}
            />
          </div>
          <div className="flex flex-row items-center justify-between px-6 py-4">
            <div className="flex flex-row items-center gap-x-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="dark:text-polar-500 text-gray-500">Total</span>
            </div>
            <span className="font-medium">
              <FormattedUnits value={quantities?.total ?? 0} />
            </span>
          </div>
        </ShadowBox>
        <div className="flex flex-col gap-y-6">
          <h2 className="text-xl">Activity</h2>
          <CustomerMeterActivityCards meter={meter} customer={customer} />
        </div>
        {meterEvents.length > 0 && (
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-1">
              <h3 className="text-xl">Events</h3>
              <p className="dark:text-polar-500 text-gray-500">
                Ingested events for the selected period
              </p>
            </div>
            <Events events={meterEvents} organization={organization} />
            <div ref={sentinelRef} />
          </div>
        )}
      </div>
    </MasterDetailLayoutContent>
  )
}

export default CustomerMeterPage

const CustomerMeterActivityCards = ({
  meter,
  customer,
}: {
  meter: schemas['Meter']
  customer: schemas['Customer']
}) => {
  const dates = useMemo(
    () => ({
      currentMonthStart: startOfMonth(new UTCDate()),
      currentMonthEnd: endOfMonth(new UTCDate()),
      lastMonthStart: startOfMonth(subMonths(new UTCDate(), 1)),
      lastMonthEnd: endOfMonth(subMonths(new UTCDate(), 1)),
      allTimeStart: new UTCDate(customer.created_at),
      allTimeEnd: new UTCDate(),
    }),
    [customer.created_at],
  )

  const { data: figuresQuantities } = useMeterQuantities(meter.id, {
    start_timestamp: dates.lastMonthStart.toISOString(),
    end_timestamp: dates.currentMonthEnd.toISOString(),
    interval: 'month',
    customer_id: customer.id,
  })

  const { data: allTimeQuantities } = useMeterQuantities(meter.id, {
    start_timestamp: dates.allTimeStart.toISOString(),
    end_timestamp: dates.allTimeEnd.toISOString(),
    interval: 'month',
    customer_id: customer.id,
  })

  return (
    <div className="flex flex-row gap-x-4">
      {[
        {
          title: 'Current Month',
          value: figuresQuantities?.quantities[1]?.quantity,
          startDate: dates.currentMonthStart,
          endDate: dates.currentMonthEnd,
        },
        {
          title: 'Previous Month',
          value: figuresQuantities?.quantities[0]?.quantity,
          startDate: dates.lastMonthStart,
          endDate: dates.lastMonthEnd,
        },
        {
          title: 'All Time',
          value: allTimeQuantities?.quantities.reduce(
            (acc, curr) => acc + curr.quantity,
            0,
          ),
          startDate: dates.allTimeStart,
          endDate: dates.allTimeEnd,
        },
      ].map((card, i) => (
        <Card key={i} className="flex-1 rounded-3xl">
          <CardHeader className="flex flex-col gap-y-0">
            <h3 className="text-lg">{card.title}</h3>
            <span className="dark:text-polar-500 text-gray-500">
              {card.startDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                ...(card.startDate.getFullYear() !==
                  new Date().getFullYear() && {
                  year: 'numeric',
                }),
              })}{' '}
              -{' '}
              {card.endDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                ...(card.endDate.getFullYear() !== new Date().getFullYear() && {
                  year: 'numeric',
                }),
              })}
            </span>
          </CardHeader>
          <CardContent>
            <span className="text-4xl">
              {card.value !== undefined ? (
                <FormattedUnits value={card.value} />
              ) : (
                '—'
              )}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
