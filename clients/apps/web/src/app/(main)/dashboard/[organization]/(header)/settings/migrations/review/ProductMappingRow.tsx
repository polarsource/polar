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
  catalogPriceNote,
  compatibleCandidates,
  formatMappingPrices,
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
  const catalogNote = catalogPriceNote(item)
  const subscriberLabel =
    item.subscriber_count === 1 ? '1 sub' : `${item.subscriber_count} subs`

  return (
    <Box flexDirection="column" rowGap="xs">
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="m"
        rowGap="xs"
        flexWrap="wrap"
      >
        <Text variant="body">
          {item.name} ·{' '}
          {formatMappingPrices(item.prices, item.recurring_interval)} ·{' '}
          {subscriberLabel}
        </Text>
        <Box alignItems="center" columnGap="s" minWidth={0}>
          <Select
            value={value || undefined}
            onValueChange={onChange}
            disabled={locked || saving}
          >
            <SelectTrigger className="w-auto min-w-40">
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
          {catalogNote ? (
            <Text variant="caption" color="muted">
              {catalogNote}
            </Text>
          ) : null}
        </Box>
      </Box>
      {item.requires_choice ? (
        <Text variant="caption" color="warning">
          A Polar product already uses this name, but the billing interval
          doesn&apos;t match. Map it, or create a new product before preparing.
        </Text>
      ) : null}
    </Box>
  )
}
