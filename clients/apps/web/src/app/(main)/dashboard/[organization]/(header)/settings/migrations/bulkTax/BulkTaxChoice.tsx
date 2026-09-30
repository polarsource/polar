'use client'

import { Alert, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  EXCLUSIVE_WARNING,
  EXCLUSIVE_WARNING_TITLE,
  TAX_DESCRIPTIONS,
  TAX_OPTIONS,
} from './bulkTaxCopy'
import { TaxBehavior } from './bulkTaxRecords'

export function ExclusiveWarning() {
  return (
    <Alert
      variant="warning"
      title={EXCLUSIVE_WARNING_TITLE}
      description={EXCLUSIVE_WARNING}
    />
  )
}

export function BulkTaxChoice({
  value,
  onChange,
}: {
  value: TaxBehavior
  onChange: (value: TaxBehavior) => void
}) {
  return (
    <Box flexDirection="column" rowGap="m">
      <Box flexDirection="column" rowGap="xs">
        <SegmentedControl
          value={value}
          onChange={onChange}
          options={TAX_OPTIONS}
        />
        <Text variant="caption" color="muted">
          {TAX_DESCRIPTIONS[value]}
        </Text>
      </Box>
      {value === 'exclusive' ? <ExclusiveWarning /> : null}
    </Box>
  )
}
