'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  CREATE_NEW_VALUE,
  compatibleCandidates,
  mappingSelectValue,
  type ProductMappingItem,
} from './productMapping'

export function ProductMappingRow({
  item,
  onChange,
  saving,
}: {
  item: ProductMappingItem
  onChange: (value: string) => void
  saving?: boolean
}) {
  const locked = item.import_status !== 'pending'
  const value = mappingSelectValue(item)
  const candidates = compatibleCandidates(item)

  return (
    <Box flexDirection="column" rowGap="xs" minWidth={0} width="100%">
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={locked || saving}
      >
        <SelectTrigger className="h-8 min-h-8 w-full min-w-0 py-0">
          <SelectValue placeholder="Polar product" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CREATE_NEW_VALUE}>
            Create a new Polar product
          </SelectItem>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {item.requires_choice ? (
        <Text variant="caption" color="warning">
          A Polar product already uses this name, but the billing interval
          doesn&apos;t match. Map it, or create a new product before preparing.
        </Text>
      ) : null}
    </Box>
  )
}
