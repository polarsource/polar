'use client'

import { useUpdateMigrationRecordTax } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

const OPTIONS: { value: schemas['TaxBehavior']; label: string }[] = [
  { value: 'inclusive', label: 'Inclusive' },
  { value: 'exclusive', label: 'Exclusive' },
]

export function ImportTaxPicker({
  migrationId,
  recordId,
  taxBehavior,
  locked = false,
}: {
  migrationId: string
  recordId: string | null
  taxBehavior: schemas['TaxBehavior'] | null
  locked?: boolean
}) {
  const [optimistic, setOptimistic] = useState<schemas['TaxBehavior'] | null>(
    null,
  )
  const update = useUpdateMigrationRecordTax(migrationId)
  const value = optimistic ?? taxBehavior ?? 'inclusive'
  const hint =
    value === 'exclusive'
      ? 'Tax is added on top of the listed price.'
      : 'Customer pays the listed price. Polar takes tax out of it.'

  if (!recordId || locked) {
    return (
      <Box flexDirection="column" rowGap="xs">
        <Text>{value === 'exclusive' ? 'Exclusive' : 'Inclusive'}</Text>
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" rowGap="s">
      <SegmentedControl
        size="sm"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          if (update.isPending || next === value) {
            return
          }
          const previous = value
          setOptimistic(next)
          update.mutate(
            { recordId, taxBehavior: next },
            {
              onError: () => setOptimistic(previous),
            },
          )
        }}
      />
      <Text variant="caption" color="muted">
        {hint}
      </Text>
      {update.isError ? (
        <Text variant="caption" color="error">
          {update.error instanceof Error && update.error.message
            ? update.error.message
            : "We couldn't save the tax setting."}
        </Text>
      ) : null}
    </Box>
  )
}
