'use client'

import { useSetMigrationTaxBehavior } from '@/hooks/queries/merchantMigrations'
import { schemas } from '@polar-sh/client'
import { Alert, Button, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

type TaxBehavior = schemas['TaxBehavior']

const OPTIONS: { value: TaxBehavior; label: string }[] = [
  { value: 'inclusive', label: 'Tax included' },
  { value: 'exclusive', label: 'Tax on top' },
]

const EXAMPLE: Record<TaxBehavior, { tax: string; pays: string }> = {
  inclusive: { tax: '$1.67 (included)', pays: '$10.00' },
  exclusive: { tax: '+ $2.00', pays: '$12.00' },
}

const RESULT: Record<TaxBehavior, string> = {
  inclusive: 'They now include tax in the price.',
  exclusive: 'They now add tax on top of the price.',
}

const numberFormat = new Intl.NumberFormat('en-US')

const updatedTitle = (count: number) =>
  count === 0
    ? 'Already up to date'
    : `Updated ${numberFormat.format(count)} ${count === 1 ? 'subscription' : 'subscriptions'}`

export function TaxAfterSwitchSection({
  migrationId,
}: {
  migrationId: string
}) {
  const [choice, setChoice] = useState<TaxBehavior>('inclusive')
  const setTaxBehavior = useSetMigrationTaxBehavior(migrationId)
  const example = EXAMPLE[choice]

  return (
    <Box flexDirection="column" rowGap="m">
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <SegmentedControl
          size="sm"
          value={choice}
          onChange={(next) => {
            if (setTaxBehavior.isPending) return
            setChoice(next)
            setTaxBehavior.reset()
          }}
          options={OPTIONS}
        />
        <Button
          size="sm"
          onClick={() => setTaxBehavior.mutate(choice)}
          loading={setTaxBehavior.isPending}
        >
          Apply to all
        </Button>
      </Box>
      <Box
        flexDirection="column"
        rowGap="xs"
        padding="m"
        borderRadius="m"
        backgroundColor="background-secondary"
      >
        <Text variant="caption" color="muted">
          Example: a $10.00 plan with 20% VAT
        </Text>
        <ExampleLine label="Price" value="$10.00" />
        <ExampleLine label="Tax" value={example.tax} />
        <ExampleLine
          label="Customer pays"
          value={example.pays}
          warning={choice === 'exclusive'}
        />
      </Box>
      {setTaxBehavior.isSuccess ? (
        <Alert
          variant="success"
          title={updatedTitle(setTaxBehavior.data.updated)}
          description={RESULT[setTaxBehavior.variables]}
          onDismiss={setTaxBehavior.reset}
        />
      ) : null}
      {setTaxBehavior.isError ? (
        <Alert
          variant="danger"
          title="We couldn't update the tax setting"
          description={setTaxBehavior.error.message}
          onDismiss={setTaxBehavior.reset}
        />
      ) : null}
    </Box>
  )
}

function ExampleLine({
  label,
  value,
  warning = false,
}: {
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <Box justifyContent="between">
      <Text variant="caption">{label}</Text>
      <Text
        variant="caption"
        tabularNums
        color={warning ? 'warning' : 'default'}
      >
        {value}
      </Text>
    </Box>
  )
}
