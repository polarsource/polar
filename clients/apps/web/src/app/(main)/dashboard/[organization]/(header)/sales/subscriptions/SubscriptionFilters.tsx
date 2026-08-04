'use client'

import DateRangePicker, {
  DateRange,
  dateRangeIntervals,
  dateRangeToMatchingInterval,
} from '@/components/Metrics/DateRangePicker'
import FilterPopover, {
  Filter,
  FilterOption,
} from '@/components/Shared/FilterPopover'
import SubscriptionCancellationSelect from '@/components/Subscriptions/SubscriptionCancellationSelect'
import SubscriptionStatusSelect, {
  subscriptionStatusFilterValues,
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionTiersSelect from '@/components/Subscriptions/SubscriptionTiersSelect'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { startOfDay } from 'date-fns'
import React, { useMemo } from 'react'

const CUSTOM_DATE_RANGE = 'custom'

const cancellationOptions: FilterOption[] = [
  { value: 'false', label: 'Renewing subscriptions' },
  { value: 'true', label: 'Ending at period end' },
]

interface SubscriptionFiltersProps {
  organization: schemas['Organization']
  products: schemas['Product'][]
  productId: string | null
  onProductSelect: (value: string | null) => void
  status: SubscriptionStatusFilter
  onStatusSelect: (value: SubscriptionStatusFilter) => void
  cancelAtPeriodEnd: boolean | null
  onCancelAtPeriodEndSelect: (value: boolean | null) => void
  dateRange: DateRange
  onDateChange: (range: DateRange) => void
  onExport: () => void
}

const SubscriptionFilters: React.FC<SubscriptionFiltersProps> = ({
  organization,
  products,
  productId,
  onProductSelect,
  status,
  onStatusSelect,
  cancelAtPeriodEnd,
  onCancelAtPeriodEndSelect,
  dateRange,
  onDateChange,
  onExport,
}) => {
  const mobileFilters = useMemo<Filter[]>(() => {
    const intervals = dateRangeIntervals(organization)
    const intervalSlug = dateRangeToMatchingInterval(
      dateRange,
      organization,
    )?.slug
    return [
      {
        key: 'status',
        label: 'Status',
        icon: <DonutLargeOutlined fontSize="inherit" />,
        type: 'single',
        options: subscriptionStatusFilterValues
          .filter((value) => value !== 'any')
          .map((value) => ({
            value,
            label:
              subscriptionStatusDisplayNames[
                value as schemas['SubscriptionStatus']
              ],
          })),
        value: status === 'any' ? null : status,
        onChange: (value) =>
          onStatusSelect((value ?? 'any') as SubscriptionStatusFilter),
      },
      ...(status === 'active'
        ? [
            {
              key: 'cancellation',
              label: 'Cancellation',
              icon: <AutorenewOutlined fontSize="inherit" />,
              type: 'single' as const,
              options: cancellationOptions,
              value:
                cancelAtPeriodEnd === null ? null : String(cancelAtPeriodEnd),
              onChange: (value: string | null) =>
                onCancelAtPeriodEndSelect(
                  value === null ? null : value === 'true',
                ),
            },
          ]
        : []),
      {
        key: 'product',
        label: 'Product',
        icon: <HiveOutlined fontSize="inherit" />,
        type: 'single',
        options: products.map((product) => ({
          value: product.id,
          label: product.name,
        })),
        value: productId,
        onChange: onProductSelect,
      },
      {
        key: 'date',
        label: 'Date',
        icon: <CalendarMonthOutlined fontSize="inherit" />,
        type: 'single',
        options: intervals.map(({ slug, label }) => ({ value: slug, label })),
        value:
          intervalSlug === 'allTime'
            ? null
            : (intervalSlug ?? CUSTOM_DATE_RANGE),
        onChange: (slug) => {
          const interval =
            intervals.find((interval) => interval.slug === slug) ??
            intervals.find(({ slug }) => slug === 'allTime')
          if (interval) {
            onDateChange({ from: interval.value[0], to: interval.value[1] })
          }
        },
      },
    ]
  }, [
    organization,
    products,
    productId,
    onProductSelect,
    status,
    onStatusSelect,
    cancelAtPeriodEnd,
    onCancelAtPeriodEndSelect,
    dateRange,
    onDateChange,
  ])

  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'stretch', md: 'center' }}
      justifyContent="between"
      gap="l"
    >
      <Box
        display={{ base: 'none', sm: 'flex' }}
        flexWrap="wrap"
        alignItems="center"
        gap="l"
        width={{ base: '100%', md: 'auto' }}
      >
        <SubscriptionStatusSelect value={status} onChange={onStatusSelect} />
        {status === 'active' && (
          <SubscriptionCancellationSelect
            value={cancelAtPeriodEnd}
            onChange={onCancelAtPeriodEndSelect}
          />
        )}
        <SubscriptionTiersSelect
          products={products}
          value={productId}
          onChange={onProductSelect}
        />
        <DateRangePicker
          date={dateRange}
          onDateChange={onDateChange}
          className="shrink-0 [&>button:last-child]:text-left"
          minDate={startOfDay(new Date(organization.created_at))}
        />
      </Box>
      <Box display={{ base: 'flex', sm: 'none' }} width="100%">
        <FilterPopover filters={mobileFilters} className="w-full" />
      </Box>
      <Button
        onClick={onExport}
        className="flex w-full flex-row items-center md:w-auto"
        variant="secondary"
        wrapperClassNames="gap-x-2"
      >
        <FileDownloadOutlined fontSize="inherit" />
        <Text>Export</Text>
      </Button>
    </Box>
  )
}

export default SubscriptionFilters
