'use client'

import { Button, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { TaxBehavior } from '../../bulkTax/bulkTaxRecords'
import { APPLIED_LABEL, APPLY_LABEL, TAX_SETTING_MIXED } from './taxSettingCopy'
import { initialChoice, TaxOptionProps } from './useTaxSetting'

const OPTIONS: { value: TaxBehavior; label: string }[] = [
  { value: 'inclusive', label: 'Tax included' },
  { value: 'exclusive', label: 'Tax on top' },
]

// Illustration only: a $10.00 price with 20% VAT.
const EXAMPLE: Record<TaxBehavior, { tax: string; pays: string }> = {
  inclusive: { tax: '$1.67 (included)', pays: '$10.00' },
  exclusive: { tax: '+ $2.00', pays: '$12.00' },
}

export function TaxOptionExample({
  current,
  canApply,
  onApply,
}: TaxOptionProps) {
  const [choice, setChoice] = useState(initialChoice(current))
  const example = EXAMPLE[choice]

  return (
    <Box flexDirection="column" rowGap="m">
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <SegmentedControl
          size="sm"
          value={choice}
          onChange={setChoice}
          options={OPTIONS}
        />
        <Button
          size="sm"
          onClick={() => onApply(choice)}
          disabled={!canApply(choice)}
        >
          {canApply(choice) ? APPLY_LABEL : APPLIED_LABEL}
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
        <Line label="Price" value="$10.00" />
        <Line label="Tax" value={example.tax} />
        <Line
          label="Customer pays"
          value={example.pays}
          warning={choice === 'exclusive'}
        />
      </Box>
      {current === 'mixed' ? (
        <Text variant="caption" color="muted">
          {TAX_SETTING_MIXED}
        </Text>
      ) : null}
    </Box>
  )
}

function Line({
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
