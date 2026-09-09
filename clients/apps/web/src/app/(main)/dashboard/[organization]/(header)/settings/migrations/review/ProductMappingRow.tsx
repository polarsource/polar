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
  const subscriberLabel =
    item.subscriber_count === 1
      ? '1 subscription'
      : `${item.subscriber_count} subscriptions`

  return (
    <Box
      flexDirection="column"
      rowGap="s"
      padding="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
    >
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="m"
        rowGap="s"
        flexWrap="wrap"
      >
        <Box flexDirection="column" rowGap="xs" minWidth={0} flex={1}>
          <Text variant="body">{item.name}</Text>
          <Text variant="caption" color="muted">
            {formatMappingPrices(item.prices, item.recurring_interval)} ·{' '}
            {subscriberLabel}
          </Text>
        </Box>
        <Box minWidth={220} flex={1}>
          <Select
            value={value || undefined}
            onValueChange={onChange}
            disabled={locked || saving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a Polar product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CREATE_NEW_VALUE}>
                Create a new Polar product
              </SelectItem>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                  {candidate.id === item.suggested_product_id
                    ? ' (suggested)'
                    : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Box>
      </Box>
      {item.requires_choice ? (
        <Text variant="caption" color="warning">
          A Polar product already uses this name, but the price or billing
          interval doesn&apos;t match. Map it, or create a new product before
          preparing.
        </Text>
      ) : null}
    </Box>
  )
}
