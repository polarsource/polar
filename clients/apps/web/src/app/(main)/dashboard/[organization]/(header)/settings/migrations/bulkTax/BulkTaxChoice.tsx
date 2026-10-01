'use client'

import { SegmentedControl, Text } from '@polar-sh/orbit'
import { TAX_DESCRIPTIONS, TAX_OPTIONS } from './bulkTaxCopy'
import { TaxBehavior } from './bulkTaxRecords'

export function BulkTaxChoice({
  value,
  onChange,
}: {
  value: TaxBehavior
  onChange: (value: TaxBehavior) => void
}) {
  return (
    <SegmentedControl
      size="sm"
      value={value}
      onChange={onChange}
      options={TAX_OPTIONS}
    />
  )
}

// Exclusive raises what customers pay, so its line reads as a warning.
export function BulkTaxChoiceHint({ value }: { value: TaxBehavior }) {
  return (
    <Text variant="caption" color={value === 'exclusive' ? 'warning' : 'muted'}>
      {TAX_DESCRIPTIONS[value]}
    </Text>
  )
}
