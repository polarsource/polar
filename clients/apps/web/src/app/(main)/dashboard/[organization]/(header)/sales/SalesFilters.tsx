'use client'

import FilterPopover, { Filter } from '@/components/Shared/FilterPopover'
import DateRangePicker, {
  DateRange,
  dateRangeIntervals,
  dateRangeToMatchingInterval,
} from '@/components/Metrics/DateRangePicker'
import { OrderStatusDisplayTitle } from '@/components/Orders/OrderStatus'
import OrderStatusSelect from '@/components/Orders/OrderStatusSelect'
import ProductSelect from '@/components/Products/ProductSelect'
import { useProducts } from '@/hooks/queries'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import HiveOutlined from '@mui/icons-material/HiveOutlined'
import { enums, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { startOfDay } from 'date-fns'
import React, { useMemo } from 'react'

interface SalesFiltersProps {
  organization: schemas['Organization']
  productId: string[] | null
  onProductSelect: (value: string[]) => void
  status: schemas['OrderStatus'] | null
  onStatusSelect: (value: schemas['OrderStatus'] | null) => void
  dateRange: DateRange
  onDateChange: (range: DateRange) => void
  onExport: () => void
}

const SalesFilters: React.FC<SalesFiltersProps> = ({
  organization,
  productId,
  onProductSelect,
  status,
  onStatusSelect,
  dateRange,
  onDateChange,
  onExport,
}) => {
  const { data: products } = useProducts(organization.id, {
    is_archived: null,
    sorting: ['name'],
    limit: 100,
  })

  const mobileFilters = useMemo<Filter[]>(() => {
    const intervals = dateRangeIntervals(organization)
    const intervalSlug = dateRangeToMatchingInterval(
      dateRange,
      organization,
    )?.slug
    return [
      {
        key: 'product',
        label: 'Product',
        icon: <HiveOutlined fontSize="inherit" />,
        type: 'multi',
        options: (products?.items ?? []).map((product) => ({
          value: product.id,
          label: `${product.name}${product.is_archived ? ' (Archived)' : ''}`,
        })),
        value: productId ?? [],
        onChange: onProductSelect,
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
        value: intervalSlug === 'allTime' ? null : (intervalSlug ?? null),
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
        gap="m"
        width={{ base: '100%', md: 'auto' }}
      >
        <Box width={{ base: '100%', md: 300 }} flexGrow={{ sm: 1, md: 0 }}>
          <ProductSelect
            organization={organization}
            value={productId ?? []}
            onChange={onProductSelect}
            className="w-full"
            includeArchived
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
