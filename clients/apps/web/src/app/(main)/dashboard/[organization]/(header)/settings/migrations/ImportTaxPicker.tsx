'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { useUpdateMigrationRecordTax } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

type TaxBehavior = schemas['TaxBehavior']

const formatMoney = formatCurrency('accounting', 'en-US')

export function ImportTaxPicker({
  migrationId,
  row,
}: {
  migrationId: string
  row: schemas['MerchantMigrationRecordItem']
}) {
  const [optimistic, setOptimistic] = useState<TaxBehavior | null>(null)
  const update = useUpdateMigrationRecordTax(migrationId)
  const value = optimistic ?? row.tax_behavior ?? 'inclusive'
  const save = (next: TaxBehavior) => {
    if (!row.record_id || update.isPending || next === value) {
      return
    }
    const previous = value
    setOptimistic(next)
    update.mutate(
      { recordId: row.record_id, taxBehavior: next },
      { onError: () => setOptimistic(previous) },
    )
  }
  const listed =
    row.amount != null && row.currency
      ? formatMoney(row.amount, row.currency)
      : null

  return (
    <DetailCell
      label="Tax after switch"
      value={
        <Box flexDirection="column" rowGap="s" width="100%">
          <Select
            value={value}
            disabled={row.cutover_status === 'moved' || !row.record_id}
            onValueChange={(next) => save(next as TaxBehavior)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inclusive">Inclusive</SelectItem>
              <SelectItem value="exclusive">Exclusive</SelectItem>
            </SelectContent>
          </Select>
          <Text variant="caption" color="muted">
            {value !== 'exclusive' ? (
              'Customer pays the listed price. Polar takes tax out of it.'
            ) : listed ? (
              <>
                The customer will pay <strong>the listed price plus tax</strong>{' '}
                instead of <strong>{listed}</strong>
              </>
            ) : (
              'Tax is added on top of the listed price.'
            )}
          </Text>
          {update.isError ? (
            <Text variant="caption" color="error">
              {update.error instanceof Error && update.error.message
                ? update.error.message
                : "We couldn't save the tax setting."}
            </Text>
          ) : null}
        </Box>
      }
    />
  )
}
