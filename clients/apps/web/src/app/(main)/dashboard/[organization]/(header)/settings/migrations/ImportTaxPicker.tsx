'use client'

import { useUpdateMigrationRecordTax } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import {
  IMPORT_TAX_OPTIONS,
  importTaxBehavior,
  importTaxHint,
  importTaxLabel,
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
  const initial = importTaxBehavior({ tax_behavior: taxBehavior })
  const [value, setValue] = useState<ImportTaxBehavior>(initial)
  const update = useUpdateMigrationRecordTax(migrationId)

  useEffect(() => {
    setValue(importTaxBehavior({ tax_behavior: taxBehavior }))
  }, [recordId, taxBehavior])

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
          setValue(next)
          update.mutate(
            { recordId, taxBehavior: next },
            { onError: () => setValue(previous) },
          )
        }}
      />
      <Text variant="caption" color="muted">
        {importTaxHint(value)}
      </Text>
      {update.isError ? (
        <Text variant="caption" color="error">
          {update.error instanceof Error
            ? update.error.message
            : "We couldn't save the tax setting."}
        </Text>
      ) : null}
    </Box>
  )
}
