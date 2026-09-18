'use client'

import { useUpdateMigrationRecordTax } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import {
  IMPORT_TAX_OPTIONS,
  importTaxBehavior,
  importTaxHint,
  importTaxLabel,
  importTaxSaveError,
  type ImportTaxBehavior,
} from './importTax'

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
  const fallback = importTaxBehavior({ tax_behavior: taxBehavior })
  const [optimistic, setOptimistic] = useState<{
    recordId: string
    value: ImportTaxBehavior
  } | null>(null)
  const update = useUpdateMigrationRecordTax(migrationId)
  const value =
    recordId && optimistic?.recordId === recordId ? optimistic.value : fallback

  if (!recordId || locked) {
    return (
      <Box flexDirection="column" rowGap="xs">
        <Text>{importTaxLabel({ tax_behavior: value })}</Text>
        <Text variant="caption" color="muted">
          {importTaxHint(value)}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" rowGap="s">
      <SegmentedControl
        size="sm"
        options={IMPORT_TAX_OPTIONS}
        value={value}
        onChange={(next) => {
          if (update.isPending || next === value) {
            return
          }
          const previous = value
          setOptimistic({ recordId, value: next })
          update.mutate(
            { recordId, taxBehavior: next },
            {
              onError: () => setOptimistic({ recordId, value: previous }),
            },
          )
        }}
      />
      <Text variant="caption" color="muted">
        {importTaxHint(value)}
      </Text>
      {update.isError ? (
        <Text variant="caption" color="error">
          {importTaxSaveError(update.error)}
        </Text>
      ) : null}
    </Box>
  )
}
