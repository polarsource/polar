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
  DEFAULT_SUBSCRIPTION_STATUS,
  subscriptionStatusFilterValues,
  type SubscriptionStatusFilter,
} from '@/components/Subscriptions/SubscriptionStatusSelect'
import SubscriptionsProductSelect, {
  type ProductFilter,
} from '@/components/Subscriptions/SubscriptionsProductSelect'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import { useProducts, useSelectedProducts } from '@/hooks/queries'
import {
  AutorenewOutlined,
  CalendarMonthOutlined,
  DonutLargeOutlined,
  FileDownloadOutlined,
  HiveOutlined,
} from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { startOfDay } from 'date-fns'
import React, { useCallback, useMemo, useState } from 'react'

const CUSTOM_DATE_RANGE = 'custom'

const cancellationOptions: FilterOption[] = [
  { value: 'false', label: 'Renewing subscriptions' },
  { value: 'true', label: 'Ending at period end' },
]

interface SubscriptionFiltersProps {
  organization: schemas['Organization']
  product: ProductFilter
  onProductSelect: (product: ProductFilter) => void
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
  product,
  onProductSelect,
  status,
  onStatusSelect,
  cancelAtPeriodEnd,
  onCancelAtPeriodEndSelect,
  dateRange,
  onDateChange,
  onExport,
}) => {
  const [productQuery, setProductQuery] = useState('')
  const filterByExternalId =
    !!organization.feature_settings?.config_as_code_enabled
  const productFilter = filterByExternalId
    ? product.external_product_id
    : product.product_id
  const onProductFilterChange = useCallback(
    (value: string | null) =>
      onProductSelect(
        filterByExternalId
          ? { product_id: null, external_product_id: value }
          : { product_id: value, external_product_id: null },
      ),
    [filterByExternalId, onProductSelect],
  )

  const { data: queriedProducts, isPending: productsPending } = useProducts(
    organization.id,
    {
      is_recurring: true,
      ...(productQuery ? { query: productQuery } : {}),
      sorting: ['name'],
      limit: 100,
    },
  )
  const selectedValues = productFilter ? [productFilter] : []
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: selectedValues }
      : { id: selectedValues },
    true,
  )

  const products = useMemo<schemas['Product'][]>(() => {
    let items = queriedProducts?.items ?? []
    if (!productQuery) {
      for (const product of selectedProducts ?? []) {
        if (!items.some(({ id }) => id === product.id)) {
          items = [...items, product]
        }
      }
    }
    return items
  }, [queriedProducts, selectedProducts, productQuery])

  const productOptions = useMemo<FilterOption[]>(
    () =>
      products.flatMap((product) => {
        const value = filterByExternalId ? product.external_id : product.id
        return value
          ? [
              {
                value,
                label: `${product.name}${product.is_archived ? ' (Archived)' : ''}`,
              },
            ]
          : []
      }),
    [products, filterByExternalId],
  )

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
        options: subscriptionStatusFilterValues.map((value) => ({
          value,
          label:
            value === 'any'
              ? 'Any status'
              : subscriptionStatusDisplayNames[value],
        })),
        value: status,
        defaultValue: DEFAULT_SUBSCRIPTION_STATUS,
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
        options: productOptions,
        loading: productsPending,
        searchPlaceholder: 'Search products…',
        searchQuery: productQuery,
        onSearchQueryChange: setProductQuery,
        value: productFilter,
        onChange: onProductFilterChange,
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
    productOptions,
    productsPending,
    productQuery,
    productFilter,
    onProductFilterChange,
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
        <Box display="block">
          <SubscriptionStatusSelect value={status} onChange={onStatusSelect} />
        </Box>
        {status === 'active' && (
          <Box display="block">
            <SubscriptionCancellationSelect
              value={cancelAtPeriodEnd}
              onChange={onCancelAtPeriodEndSelect}
            />
          </Box>
        )}
        <Box display="block">
          <SubscriptionsProductSelect
            options={productOptions}
            value={productFilter}
            onChange={onProductFilterChange}
          />
        </Box>
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
