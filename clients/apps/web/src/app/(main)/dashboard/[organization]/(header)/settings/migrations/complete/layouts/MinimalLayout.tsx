'use client'

import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, Search } from 'lucide-react'
import { useState } from 'react'
import { KIND_LABELS } from '../completeCopy'
import { PolarIdCell } from '../mappingColumns'
import { downloadMapping } from '../mappingExport'
import { lookupStripeIds } from '../mappingSearch'
import { LayoutProps, numberFormat } from './shared'

// One outcome, one download, one lookup. Everything else is a link away.
export function MinimalLayout(props: LayoutProps) {
  const { report, mapping, organizationSlug, onOpenSwitch, phase } = props
  const [query, setQuery] = useState('')
  const [result] = lookupStripeIds(mapping, query)
  const stillOnStripe = report.pending + report.skipped + report.failed

  return (
    <Box flexDirection="column" rowGap="xl" maxWidth={560} paddingVertical="l">
      <Box columnGap="m" alignItems="start">
        <Box
          flexShrink={0}
          width={32}
          height={32}
          borderRadius="full"
          backgroundColor="background-success"
          color="text-success"
          alignItems="center"
          justifyContent="center"
        >
          <Check size={16} />
        </Box>
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xs" as="h2">
            {numberFormat.format(report.moved)} of{' '}
            {numberFormat.format(mapping.subscriptions.length)} subscriptions
            {phase === 'complete' ? ' now bill on Polar' : ' switched so far'}
          </Text>
          {stillOnStripe > 0 && (
            <Box
              as="span"
              display="inline-flex"
              columnGap="xs"
              cursor={{ hover: 'pointer' }}
              color={{ base: 'text-secondary', hover: 'text-primary' }}
              onClick={onOpenSwitch}
            >
              <Text variant="caption" color="inherit">
                {numberFormat.format(stillOnStripe)} still on Stripe ·{' '}
                {report.pending > 0 ? 'Continue switching' : 'Review'} →
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box columnGap="s">
        <Button onClick={() => downloadMapping(mapping, 'csv')}>
          Download Stripe → Polar ID map
        </Button>
        <Button
          variant="ghost"
          onClick={() => downloadMapping(mapping, 'json')}
        >
          JSON
        </Button>
      </Box>

      <Box flexDirection="column" rowGap="s">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find the Polar ID for a cus_, sub_, prod_, price_ or coupon ID"
          preSlot={<Search size={14} />}
        />
        {result &&
          (result.rows.length === 0 ? (
            <Text variant="caption" color="muted">
              {result.stripeId} isn&apos;t part of this migration.
            </Text>
          ) : (
            result.rows.map((row) => (
              <Box
                key={`${row.kind}:${row.detail ?? ''}`}
                columnGap="m"
                alignItems="center"
              >
                <Text variant="caption" color="muted">
                  {KIND_LABELS[row.kind]}
                  {row.detail ? ` · ${row.detail}` : ''}
                </Text>
                <PolarIdCell row={row} organizationSlug={organizationSlug} />
              </Box>
            ))
          ))}
      </Box>
    </Box>
  )
}
