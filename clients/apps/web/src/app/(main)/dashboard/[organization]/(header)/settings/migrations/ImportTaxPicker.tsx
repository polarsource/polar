'use client'

import { DetailCell } from '@/components/Orders/OrderSection'
import { useUpdateMigrationRecord } from '@/hooks/queries/merchantMigrations'
import { useOptimisticSave } from '@/hooks/useOptimisticSave'
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

type TaxBehavior = schemas['TaxBehavior']

const formatMoney = formatCurrency('accounting', 'en-US')

export function ImportTaxPicker({
  migrationId,
  row,
}: {
  migrationId: string
  row: schemas['MerchantMigrationRecordItem']
}) {
  const updateRecord = useUpdateMigrationRecord(migrationId)
  const { value, update } = useOptimisticSave<TaxBehavior>(
    row.tax_behavior ?? 'inclusive',
    async (next) => {
      if (!row.record_id) {
        return false
      }
      try {
        await updateRecord.mutateAsync({
          recordId: row.record_id,
          update: { tax_behavior: next },
        })
        return true
      } catch {
        return false
      }
    },
  )
  const listed =
    row.amount != null && row.currency
      ? formatMoney(row.amount, row.currency)
      : null
  const locked = row.cutover_status === 'moved' || !row.record_id

  return (
    <DetailCell
      label="Tax after switch"
      value={
        <Box flexDirection="column" rowGap="s" width="100%">
          <Select
            value={value}
            disabled={locked}
            onValueChange={(next) => update(next as TaxBehavior)}
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
          {updateRecord.isError ? (
            <Text variant="caption" color="error">
              {updateRecord.error instanceof Error && updateRecord.error.message
                ? updateRecord.error.message
                : "We couldn't save the tax setting."}
            </Text>
          ) : null}
        </Box>
      }
    />
  )
}
