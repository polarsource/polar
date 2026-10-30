'use client'

import FilterPopover, {
  Filter,
  FilterOption,
} from '@/components/Shared/FilterPopover'
import DateRangePicker, {
  DateRange,
  dateRangeIntervals,
  dateRangeToMatchingInterval,
} from '@/components/Metrics/DateRangePicker'
import { OrderStatusDisplayTitle } from '@/components/Orders/OrderStatus'
import OrderStatusSelect from '@/components/Orders/OrderStatusSelect'
import ProductSelect from '@/components/Products/ProductSelect'
import { useProducts, useSelectedProducts } from '@/hooks/queries'
import {
  CalendarMonthOutlined,
  DonutLargeOutlined,
  FileDownloadOutlined,
  HiveOutlined,
} from '@polar-sh/orbit/icons'
import { enums, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { startOfDay } from 'date-fns'
import React, { useMemo, useState } from 'react'

const CUSTOM_DATE_RANGE = 'custom'

export interface ProductFilter {
  product_id: string[] | null
  external_product_id: string[] | null
}

interface SalesFiltersProps {
  organization: schemas['Organization']
  productId: string[] | null
  externalProductId: string[] | null
  onProductSelect: (value: ProductFilter) => void
  status: schemas['OrderStatus'] | null
  onStatusSelect: (value: schemas['OrderStatus'] | null) => void
  dateRange: DateRange
  onDateChange: (range: DateRange) => void
  onExport: () => void
}

const SalesFilters: React.FC<SalesFiltersProps> = ({
  organization,
  productId,
  externalProductId,
  onProductSelect,
  status,
  onStatusSelect,
  dateRange,
  onDateChange,
  onExport,
}) => {
  const [productQuery, setProductQuery] = useState('')
  // A product_id link keeps filtering by ID until the selection is cleared
  const filterByExternalId =
    !!organization.feature_settings?.config_as_code_enabled && !productId
  const productFilter = filterByExternalId ? externalProductId : productId
  const onProductFilterChange = (value: string[]) => {
    const selected = value.length > 0 ? value : null
    onProductSelect(
      filterByExternalId
        ? { product_id: null, external_product_id: selected }
        : { product_id: selected, external_product_id: null },
    )
  }

  const { data: products, isPending: productsPending } = useProducts(
    organization.id,
    {
      is_archived: null,
      ...(productQuery ? { query: productQuery } : {}),
      sorting: ['name'],
      limit: 50,
    },
  )
  const { data: selectedProducts } = useSelectedProducts(
    filterByExternalId
      ? { organization_id: organization.id, external_id: productFilter ?? [] }
      : { id: productFilter ?? [] },
    true,
  )

  const productOptions = useMemo<FilterOption[]>(() => {
    let items = products?.items ?? []
    if (!productQuery) {
      for (const product of selectedProducts ?? []) {
        if (!items.some(({ id }) => id === product.id)) {
          items = [...items, product]
        }
      }
    }
    return items.flatMap((product) => {
      const value = filterByExternalId ? product.external_id : product.id
      return value
        ? [
            {
              value,
              label: `${product.name}${product.is_archived ? ' (Archived)' : ''}`,
            },
          ]
        : []
    })
  }, [products, selectedProducts, productQuery, filterByExternalId])

  const intervals = dateRangeIntervals(organization)
  const intervalSlug = dateRangeToMatchingInterval(
    dateRange,
    organization,
  )?.slug
  const mobileFilters: Filter[] = [
    {
      key: 'product',
      label: 'Product',
      icon: <HiveOutlined fontSize="inherit" />,
      type: 'multi',
      options: productOptions,
      loading: productsPending,
      searchPlaceholder: 'Search products…',
      searchQuery: productQuery,
      onSearchQueryChange: setProductQuery,
      value: productFilter ?? [],
      onChange: onProductFilterChange,
    },
    {
      key: 'status',
      label: 'Status',
      icon: <DonutLargeOutlined fontSize="inherit" />,
      type: 'single',
      options: enums.orderStatusValues.map((value) => ({
        value,
        label: OrderStatusDisplayTitle[value],
      })),
      value: status,
      onChange: (value) =>
        onStatusSelect(value as schemas['OrderStatus'] | null),
    },
    {
      key: 'date',
      label: 'Date',
      icon: <CalendarMonthOutlined fontSize="inherit" />,
      type: 'single',
      options: intervals.map(({ slug, label }) => ({ value: slug, label })),
      value:
        intervalSlug === 'allTime' ? null : (intervalSlug ?? CUSTOM_DATE_RANGE),
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
        gap="m"
        width={{ base: '100%', md: 'auto' }}
      >
        <Box width={{ base: '100%', md: 300 }} flexGrow={{ sm: 1, md: 0 }}>
          <ProductSelect
            organization={organization}
            value={productFilter ?? []}
            onChange={onProductFilterChange}
            className="w-full"
            includeArchived
            filterByExternalId={filterByExternalId}
          />
        </Box>
        <Box
          width={{ base: '100%', sm: 'auto' }}
          minWidth={{ sm: 160 }}
          maxWidth={{ md: 200 }}
          flexGrow={{ sm: 1, md: 0 }}
        >
          <OrderStatusSelect value={status} onChange={onStatusSelect} />
        </Box>
        <DateRangePicker
          className="w-full shrink-0 sm:w-52 [&>button:last-child]:text-left"
          date={dateRange}
          onDateChange={onDateChange}
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

export default SalesFilters
