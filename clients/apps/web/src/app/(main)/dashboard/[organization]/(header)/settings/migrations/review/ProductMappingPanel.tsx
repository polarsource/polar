'use client'

import {
  useProductMappings,
  useUpdateProductMappings,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ProductMappingRow } from './ProductMappingRow'
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
    <Box flexDirection="column" rowGap="s">
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
      {visible.map((item) => (
        <ProductMappingRow
          key={item.source_id}
          item={item}
          saving={updateMappings.isPending}
          onChange={(value) =>
            updateMappings.mutate([mappingChoice(item.source_id, value)])
          }
        />
      ))}
    </Box>
  )
}
