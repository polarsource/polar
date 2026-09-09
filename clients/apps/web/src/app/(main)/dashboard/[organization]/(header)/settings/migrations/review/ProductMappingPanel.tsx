'use client'

import {
  useProductMappings,
  useUpdateProductMappings,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback } from 'react'
import { ProductMappingTable } from './ProductMappingTable'
import {
  mappingChoice,
  shouldShowProductMappingPanel,
  visibleMappingItems,
} from './productMapping'

export function ProductMappingPanel({ migrationId }: { migrationId: string }) {
  const mappings = useProductMappings(migrationId)
  const updateMappings = useUpdateProductMappings(migrationId)
  const items = mappings.data?.items ?? []
  const visible = visibleMappingItems(items)
  const mutateMappings = updateMappings.mutate

  const onChange = useCallback(
    (sourceId: string, value: string) => {
      mutateMappings([mappingChoice(sourceId, value)])
    },
    [mutateMappings],
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
    <Box as="section" flexDirection="column" rowGap="s">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Product configuration
        </Text>
        <Text variant="caption" color="muted">
          Map each Stripe product with subscribers onto a Polar product.
          Imported subscribers keep their Stripe price if Polar&apos;s catalog
          has moved on.
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
      <ProductMappingTable
        items={visible}
        saving={updateMappings.isPending}
        onChange={onChange}
      />
    </Box>
  )
}
