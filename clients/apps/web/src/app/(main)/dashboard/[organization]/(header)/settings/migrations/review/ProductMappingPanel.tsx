'use client'

import {
  useProductMappings,
  useUpdateProductMappings,
} from '@/hooks/queries/merchantMigrations'
import {
  Alert,
  DataTable,
  Spinner,
  Text,
  type DataTableColumnDef,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useMemo } from 'react'
import { ProductMappingRow } from './ProductMappingRow'
import {
  formatMappingAmount,
  formatMappingInterval,
  mappingChoice,
  shouldShowProductMappingPanel,
  visibleMappingItems,
  type ProductMappingItem,
} from './productMapping'

export function ProductMappingPanel({ migrationId }: { migrationId: string }) {
  const mappings = useProductMappings(migrationId)
  const updateMappings = useUpdateProductMappings(migrationId)
  const items = mappings.data?.items ?? []
  const visible = visibleMappingItems(items)
  const saving = updateMappings.isPending
  const mutateMappings = updateMappings.mutate

  const onChange = useCallback(
    (sourceId: string, value: string) => {
      mutateMappings([mappingChoice(sourceId, value)])
    },
    [mutateMappings],
  )

  const columns = useMemo(
    () => buildProductMappingColumns({ saving, onChange }),
    [saving, onChange],
  )

  if (mappings.isLoading) {
    return (
      <Box padding="l" alignItems="center" justifyContent="center">
        <Spinner />
      </Box>
    )
  }

  if (mappings.isError) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load product mappings"
        description="Something went wrong. Please refresh and try again."
      />
    )
  }

  if (!shouldShowProductMappingPanel(items)) {
    return null
  }

  return (
    <Box as="section" flexDirection="column" rowGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Product configuration
        </Text>
        <Text variant="caption" color="muted">
          Map each Stripe product that still has subscribers onto a Polar
          product so they keep the same benefits. Choose an existing Polar
          product, or create a new one. Imported subscribers keep their Stripe
          price if Polar&apos;s catalog has moved on.
        </Text>
      </Box>
      {updateMappings.isError ? (
        <Alert
          variant="danger"
          title="We couldn't save that mapping"
          description={
            updateMappings.error?.message ||
            'Something went wrong. Please try again.'
          }
        />
      ) : null}
      <DataTable
        columns={columns}
        data={visible}
        isLoading={false}
        getRowId={(row) => row.source_id}
      />
    </Box>
  )
}

function buildProductMappingColumns({
  onChange,
  saving,
}: {
  onChange: (sourceId: string, value: string) => void
  saving: boolean
}): DataTableColumnDef<ProductMappingItem>[] {
  return [
    {
      id: 'name',
      size: 220,
      header: 'Stripe product',
      cell: ({ row }) => (
        <Box minWidth={0}>
          <Text truncate>{row.original.name}</Text>
        </Box>
      ),
    },
    {
      id: 'interval',
      size: 120,
      header: 'Interval',
      cell: ({ row }) => (
        <Text color="muted">
          {formatMappingInterval(
            row.original.recurring_interval,
            row.original.recurring_interval_count,
          )}
        </Text>
      ),
    },
    {
      id: 'price',
      size: 120,
      header: 'Price',
      cell: ({ row }) => (
        <Text monospace tabularNums>
          {formatMappingAmount(row.original.prices)}
        </Text>
      ),
    },
    {
      id: 'subscriptions',
      size: 120,
      header: 'Subscriptions',
      cell: ({ row }) => (
        <Text tabularNums>{row.original.subscriber_count}</Text>
      ),
    },
    {
      id: 'action',
      size: 280,
      header: 'Polar product',
      cell: ({ row }) => (
        <ProductMappingRow
          item={row.original}
          saving={saving}
          onChange={(value) => onChange(row.original.source_id, value)}
        />
      ),
    },
  ]
}
