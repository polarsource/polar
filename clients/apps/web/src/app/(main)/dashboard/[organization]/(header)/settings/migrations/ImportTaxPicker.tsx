'use client'

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
  recordId,
  taxBehavior,
  amount,
  currency,
  locked = false,
}: {
  migrationId: string
  recordId: string | null
  taxBehavior: TaxBehavior | null
  amount?: number | null
  currency?: string | null
  locked?: boolean
}) {
  const [optimistic, setOptimistic] = useState<TaxBehavior | null>(null)
  const update = useUpdateMigrationRecordTax(migrationId)
  const value = optimistic ?? taxBehavior ?? 'inclusive'

  const save = (next: TaxBehavior) => {
    if (!recordId || update.isPending || next === value) {
      return
    }
    const previous = value
    setOptimistic(next)
    update.mutate(
      { recordId, taxBehavior: next },
      { onError: () => setOptimistic(previous) },
    )
  }

  return (
    <Box flexDirection="column" rowGap="s" width="100%">
      <Select
        value={value}
        disabled={locked || !recordId}
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
      <Hint value={value} amount={amount} currency={currency} />
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

function Hint({
  value,
  amount,
  currency,
}: {
  value: TaxBehavior
  amount?: number | null
  currency?: string | null
}) {
  if (value !== 'exclusive') {
    return (
      <Text variant="caption" color="muted">
        Customer pays the listed price. Polar takes tax out of it.
      </Text>
    )
  }

  const listed =
    amount != null && currency ? formatMoney(amount, currency) : null

  if (!listed) {
    return (
      <Text variant="caption" color="muted">
        Tax is added on top of the listed price.
      </Text>
    )
  }

  return (
    <Text variant="caption" color="muted">
      The customer will pay <strong>the listed price plus tax</strong> instead
      of <strong>{listed}</strong>
    </Text>
  )
}
