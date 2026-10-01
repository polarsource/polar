'use client'

import { Text, TextArea } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { KIND_LABELS } from './completeCopy'
import { MappingKind, MappingRow } from './idMapping'
import { MappingStatus, PolarIdCell } from './mappingColumns'
import { lookupStripeIds } from './mappingSearch'

export function IdLookup({
  mapping,
  organizationSlug,
}: {
  mapping: Record<MappingKind, MappingRow[]>
  organizationSlug: string
}) {
  const [input, setInput] = useState('')
  const results = useMemo(
    () => lookupStripeIds(mapping, input),
    [mapping, input],
  )

  return (
    <Box flexDirection="column" rowGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          Look up a Stripe ID
        </Text>
        <Text variant="caption" color="muted">
          Paste one or more cus_, sub_, prod_, price_ or coupon IDs to get the
          Polar ID they became.
        </Text>
      </Box>
      <TextArea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={'cus_PQxYz123\nsub_1OaBcD…'}
        rows={3}
      />
      {results.length > 0 && (
        <Box
          as="ul"
          flexDirection="column"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="l"
          overflow="hidden"
        >
          {results.map(({ stripeId, rows }, index) => (
            <Box
              as="li"
              key={stripeId}
              display="flex"
              flexDirection="column"
              rowGap="xs"
              padding="m"
              borderTopWidth={index === 0 ? 0 : 1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Text variant="caption" monospace color="muted">
                {stripeId}
              </Text>
              {rows.length === 0 ? (
                <Text variant="caption" color="muted">
                  Not part of this migration.
                </Text>
              ) : (
                rows.map((row) => (
                  <Box
                    key={`${row.kind}:${row.detail ?? ''}`}
                    alignItems="center"
                    columnGap="m"
                    flexWrap="wrap"
                  >
                    <Text variant="caption">
                      {KIND_LABELS[row.kind]} · {row.label}
                      {row.detail ? ` · ${row.detail}` : ''}
                    </Text>
                    <PolarIdCell
                      row={row}
                      organizationSlug={organizationSlug}
                    />
                    <MappingStatus row={row} />
                  </Box>
                ))
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
