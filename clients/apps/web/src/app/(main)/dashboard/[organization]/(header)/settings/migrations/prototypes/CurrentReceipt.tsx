'use client'

import { Button, SegmentedControl, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { PrototypeAction, PrototypeState } from './model'
import { CurrentRecordRow } from './CurrentRecordList'
import { Metric, Surface } from './PrototypePrimitives'
import { TOP_ISSUE_CODES } from './recordLabels'
import { getCleanSubscriptions, getProblemSubscriptions } from './selectors'

type ReceiptFilter = 'polar' | 'stripe' | 'unknown'

export function CurrentReceipt({
  state,
  act,
}: {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}) {
  const clean = getCleanSubscriptions()
  const problems = [...getProblemSubscriptions()].sort((left, right) => {
    const rank = new Map(TOP_ISSUE_CODES.map((code, index) => [code, index]))
    return (
      (rank.get(left.issueCode) ?? TOP_ISSUE_CODES.length) -
      (rank.get(right.issueCode) ?? TOP_ISSUE_CODES.length)
    )
  })
  const receipt = state.receipt
  const polar = receipt?.polarOwned ?? clean.length
  const stripe = receipt?.stripeOwned ?? problems.length
  const unknown = receipt?.unknownOwned ?? 0
  const [filter, setFilter] = useState<ReceiptFilter>('stripe')

  const rows = filter === 'polar' ? clean : filter === 'stripe' ? problems : []

  return (
    <Box flexDirection="column" rowGap="l">
      <Surface>
        <Status
          status={`Completed with ${stripe} left on Stripe`}
          color="yellow"
        />
        <Text variant="heading-xs" as="h3">
          Switch receipt
        </Text>
        <Box gap="xl" flexWrap="wrap">
          <Metric label="Billing on Polar" value={polar} />
          <Metric label="Billing on Stripe" value={stripe} />
          <Metric label="Unknown owner" value={unknown} />
        </Box>
        <Text color="muted" wrap="pretty">
          {polar} subscriptions now bill on Polar. All {stripe} problem records
          remain on Stripe with documented outcomes and reasons. Unknown owners:{' '}
          {unknown}.
        </Text>
        <Box gap="s" flexWrap="wrap">
          <Button variant="secondary" onClick={() => act('review_receipt')}>
            Export receipt
          </Button>
          <Button onClick={() => act('close')}>
            Close with billing on Stripe
          </Button>
        </Box>
        {state.receiptViewed ? (
          <Text variant="caption" color="success" role="status">
            Mock receipt exported.
          </Text>
        ) : null}
      </Surface>

      <Box flexDirection="column" rowGap="m">
        <Box
          alignItems={{ base: 'start', md: 'center' }}
          justifyContent="between"
          gap="m"
          flexWrap="wrap"
        >
          <Text variant="heading-xs" as="h3">
            Outcomes &amp; reasons
          </Text>
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={(next) => setFilter(next as ReceiptFilter)}
            options={[
              { value: 'polar', label: `On Polar ${polar}` },
              { value: 'stripe', label: `On Stripe ${stripe}` },
              { value: 'unknown', label: `Unknown ${unknown}` },
            ]}
          />
        </Box>

        {filter === 'stripe' ? (
          <Text variant="caption" color="muted">
            Top requested problems first: missing country, existing Polar
            product, email identity conflict. Outcomes and reasons stay
            reachable for every residual Stripe record.
          </Text>
        ) : null}

        {rows.length === 0 ? (
          <Text variant="caption" color="muted">
            {filter === 'unknown'
              ? 'No unknown owners in this mock receipt.'
              : 'No records in this outcome.'}
          </Text>
        ) : (
          <Box
            as="ul"
            flexDirection="column"
            rowGap="s"
            aria-label="Receipt outcomes"
          >
            {rows.map((record) => (
              <CurrentRecordRow
                key={record.id}
                record={record}
                transferred
                emphasize={
                  filter === 'stripe' &&
                  TOP_ISSUE_CODES.includes(record.issueCode)
                }
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
