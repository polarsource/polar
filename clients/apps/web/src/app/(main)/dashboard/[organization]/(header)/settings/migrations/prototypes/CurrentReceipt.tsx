'use client'

import { Button, SegmentedControl, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { buildCurrentColumns } from './CurrentRecordColumns'
import { CurrentDataTable, useCurrentPagination } from './CurrentDataTable'
import { PrototypeAction, PrototypeState } from './model'
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
  const problems = useMemo(() => {
    const rank = new Map(TOP_ISSUE_CODES.map((code, index) => [code, index]))
    return [...getProblemSubscriptions()].sort((left, right) => {
      return (
        (rank.get(left.issueCode) ?? TOP_ISSUE_CODES.length) -
        (rank.get(right.issueCode) ?? TOP_ISSUE_CODES.length)
      )
    })
  }, [])
  const receipt = state.receipt
  const polar = receipt?.polarOwned ?? clean.length
  const stripe = receipt?.stripeOwned ?? problems.length
  const unknown = receipt?.unknownOwned ?? 0
  const [filter, setFilter] = useState<ReceiptFilter>('stripe')
  const { page, pageSize, pagination, onPaginationChange, resetPage } =
    useCurrentPagination()

  const rows = filter === 'polar' ? clean : filter === 'stripe' ? problems : []

  const columns = useMemo(
    () =>
      buildCurrentColumns({
        isSelectable: () => false,
        isSelected: () => false,
        headerState: 'unchecked',
        canSelectAll: false,
        onToggle: () => undefined,
        onToggleAll: () => undefined,
        showSelect: false,
        transferred: true,
      }),
    [],
  )

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
            onChange={(next) => {
              setFilter(next as ReceiptFilter)
              resetPage()
            }}
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
            product, email identity conflict. Open a row for the issue detail
            and recommended action.
          </Text>
        ) : null}

        <CurrentDataTable
          columns={columns}
          rows={rows}
          page={page}
          pageSize={pageSize}
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          transferred
          emptyMessage={
            filter === 'unknown'
              ? 'No unknown owners in this mock receipt.'
              : 'No records in this outcome.'
          }
        />
      </Box>
    </Box>
  )
}
