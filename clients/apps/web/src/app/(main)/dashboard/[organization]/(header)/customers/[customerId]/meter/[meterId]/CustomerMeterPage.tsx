'use client'

import { AddCreditsButton } from '@/components/Customer/AddCredits/AddCreditsButton'
import { CreditHistory } from '@/components/Customer/CreditHistory/CreditHistory'
import { MeterPeriodEvents } from '@/components/Customer/CustomerMeter/MeterPeriodEvents'
import { MeterPeriodSelect } from '@/components/Customer/CustomerMeter/MeterPeriodSelect'
import { MeterPeriodSummary } from '@/components/Customer/CustomerMeter/MeterPeriodSummary'
import {
  useMeterPeriods,
  useMeterPeriodUsage,
} from '@/components/Customer/CustomerMeter/useMeterPeriods'
import { MasterDetailLayoutContent } from '@/components/Layout/MasterDetailLayout'
import { useCustomerMeters } from '@/hooks/queries/customerMeters'
import { useSubscriptions } from '@/hooks/queries/subscriptions'
import { isMeteredPrice, MeteredPrice } from '@/utils/product'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { parseAsInteger, useQueryState } from 'nuqs'
import { useMemo } from 'react'

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

  const unitPrice = useMemo(
    () =>
      subscription?.product.prices.find(
        (p): p is MeteredPrice => isMeteredPrice(p) && p.meter_id === meter.id,
      ) ?? null,
    [subscription, meter.id],
  )

  const { data: customerMetersData } = useCustomerMeters(organization.id, {
    customer_id: customer.id,
    meter_id: meter.id,
  })
  const customerMeter = customerMetersData?.items[0] ?? null

  const periods = useMeterPeriods({
    organization,
    customer,
    meter,
    subscription,
  })
  const [periodParam, setPeriodParam] = useQueryState(
    'period',
    parseAsInteger.withDefault(0),
  )
  const periodIndex = Math.min(Math.max(periodParam, 0), periods.length - 1)
  const period = periods[periodIndex]

  const usage = useMeterPeriodUsage({
    organization,
    customer,
    meter,
    period,
    customerMeter,
  })

  const addCreditsButton = (
    <AddCreditsButton
      organization={organization}
      customer={customer}
      meterId={meter.id}
    />
  )

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
            <Box
              display={{ base: 'flex', md: 'none' }}
              marginLeft="auto"
              flexShrink={0}
            >
              {addCreditsButton}
            </Box>
          </Box>
          <Box alignItems="center" flexWrap="wrap" gap="s">
            {periods.length > 1 && (
              <MeterPeriodSelect
                periods={periods}
                selected={periodIndex}
                onSelect={setPeriodParam}
              />
            )}
            <Box display={{ base: 'none', md: 'flex' }}>{addCreditsButton}</Box>
          </Box>
        </>
      }
    >
      <Box flexDirection="column" rowGap="3xl">
        <MeterPeriodSummary
          meter={meter}
          period={period}
          usage={usage}
          unitPrice={unitPrice}
        />
        <CreditHistory organization={organization} credits={usage.credits} />
        <MeterPeriodEvents
          key={period.start.toISOString()}
          organization={organization}
          customer={customer}
          meter={meter}
          period={period}
        />
      </Box>
    </MasterDetailLayoutContent>
  )
}

export default CustomerMeterPage
