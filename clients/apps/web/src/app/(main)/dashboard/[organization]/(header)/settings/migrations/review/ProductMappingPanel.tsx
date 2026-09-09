'use client'

import {
  useProductMappings,
  useUpdateProductMappings,
} from '@/hooks/queries/merchantMigrations'
import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ProductMappingRow } from './ProductMappingRow'
import { mappingChoice, shouldShowProductMappingPanel } from './productMapping'

export function ProductMappingPanel({ migrationId }: { migrationId: string }) {
  const mappings = useProductMappings(migrationId)
  const updateMappings = useUpdateProductMappings(migrationId)
  const items = mappings.data?.items ?? []

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
    <Box flexDirection="column" rowGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs">Map existing Polar products</Text>
        <Text variant="caption" color="muted">
          If you already sell these plans on Polar, map each Stripe product onto
          the matching Polar product so subscribers keep the same benefits.
          Polar suggests a match when amount, currency, and billing interval are
          unique.
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
      {items.map((item) => (
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
