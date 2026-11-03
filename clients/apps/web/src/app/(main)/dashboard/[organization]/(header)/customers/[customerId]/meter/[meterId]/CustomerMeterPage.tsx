'use client'

import { MeterPeriodDetails } from '@/components/Customer/CustomerMeter/MeterPeriodDetails'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import DateRangePicker, {
  DateRangeInterval,
} from '@/components/Metrics/DateRangePicker'
import IntervalPicker, {
  getNextValidInterval,
} from '@/components/Metrics/IntervalPicker'
import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { isMeteredPrice, MeteredPrice } from '@/utils/product'
import { ArrowBackOutlined } from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { endOfMonth, startOfMonth } from 'date-fns'
import Link from 'next/link'
import {
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import { useCallback, useMemo } from 'react'

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

  const [, setPage] = useQueryState('page', parseAsInteger)

  const onDateChange = useCallback(
    (date: { from: Date; to: Date }) => {
      const valid = getNextValidInterval(interval, date.from, date.to)
      setStartDate(date.from)
      setEndDate(date.to)
      setPage(null)
      if (valid !== interval) setInterval(valid)
    },
    [interval, setStartDate, setEndDate, setInterval, setPage],
  )

  const { data: subscriptionsData, isPending: subscriptionsPending } =
    useSubscriptions(organization.id, {
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

  const { startDate, endDate } = useMemo(
    () => ({
      startDate:
        startDateParam ??
        billingPeriodInterval?.value[0] ??
        startOfMonth(new Date()),
      endDate:
        endDateParam ??
        billingPeriodInterval?.value[1] ??
        endOfMonth(new Date()),
    }),
    [startDateParam, endDateParam, billingPeriodInterval],
  )

  const unitPrice = useMemo(
    () =>
      subscription?.product.prices.find(
        (p): p is MeteredPrice => isMeteredPrice(p) && p.meter_id === meter.id,
      ) ?? null,
    [subscription, meter.id],
  )

  const { data: customerMetersData, isPending: customerMetersPending } =
    useCustomerMeters(organization.id, {
      customer_id: customer.id,
      meter_id: meter.id,
    })
  const customerMeter = customerMetersData?.items[0] ?? null

  const isCurrentPeriod =
    billingPeriodInterval !== null &&
    startDate.getTime() === billingPeriodInterval.value[0].getTime() &&
    endDate.getTime() === billingPeriodInterval.value[1].getTime()

  return (
    <MasterDetailLayoutContent
      header={
        <>
          <Box alignItems="center" columnGap="l" minWidth={0}>
            <Link
              href={`/dashboard/${organization.slug}/customers/${customer.id}`}
              className="dark:text-polar-500 shrink-0 text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowBackOutlined fontSize="small" />
            </Link>
            <Box flexDirection="column" minWidth={0}>
              <Link
                href={`/dashboard/${organization.slug}/products/meters/${meter.id}`}
                className="truncate hover:underline"
              >
                <Text variant="heading-xxs" as="h1">
                  {meter.name}
                </Text>
              </Link>
              <Text color="muted">
                {customer.name || customer.email || 'Customer'}
                {subscription && ` · ${subscription.product.name}`}
              </Text>
            </Box>
          </Box>
          <Box alignItems="center" flexWrap="wrap" gap="s">
            <Box display="block">
              <IntervalPicker
                interval={interval}
                onChange={setInterval}
                startDate={startDate}
                endDate={endDate}
              />
            </Box>
            <DateRangePicker
              date={{ from: startDate, to: endDate }}
              onDateChange={onDateChange}
              additionalIntervals={
                billingPeriodInterval ? [billingPeriodInterval] : undefined
              }
            />
          </Box>
        </>
      }
    >
      {!subscriptionsPending && !customerMetersPending && (
        <MeterPeriodDetails
          organization={organization}
          customer={customer}
          meter={meter}
          currentPeriod={
            isCurrentPeriod && subscription && customerMetersData
              ? { subscription, customerMeter, unitPrice }
              : null
          }
          currentPeriodStart={billingPeriodInterval?.value[0] ?? null}
          startDate={startDate}
          endDate={endDate}
          interval={interval}
        />
      )}
    </MasterDetailLayoutContent>
  )
}

export default CustomerMeterPage
