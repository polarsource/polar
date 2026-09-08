'use client'

import { Button, Input, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { HeaderCheckState, buildCurrentColumns } from './CurrentRecordColumns'
import { CurrentDataTable, useCurrentPagination } from './CurrentDataTable'
import { MockSubscriptionRecord, mockSubscriptions } from './mockData'
import { PrototypeAction } from './model'
import { TOP_ISSUE_CODES } from './recordLabels'
import {
  getCleanSubscriptions,
  getInitialTotals,
  getProblemSubscriptions,
} from './selectors'

type AssessmentFilter = 'all' | 'to_prepare' | 'ready' | 'attention' | 'skipped'

const numberFormat = new Intl.NumberFormat('en-US')

function prioritizeTopProblems(
  records: MockSubscriptionRecord[],
): MockSubscriptionRecord[] {
  const rank = new Map(TOP_ISSUE_CODES.map((code, index) => [code, index]))
  return [...records].sort((left, right) => {
    const leftRank = rank.get(left.issueCode) ?? TOP_ISSUE_CODES.length
    const rightRank = rank.get(right.issueCode) ?? TOP_ISSUE_CODES.length
    return leftRank - rightRank
  })
}

function matchesQuery(record: MockSubscriptionRecord, query: string): boolean {
  if (!query) {
    return true
  }
  const haystack = [
    record.customerLabel,
    record.customerEmail ?? '',
    record.productName,
    record.title,
    record.issueCode,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function CurrentAssessment({
  act,
}: {
  act: (action: PrototypeAction) => void
}) {
  const totals = getInitialTotals()
  const clean = getCleanSubscriptions()
  const cleanIds = useMemo(() => new Set(clean.map((row) => row.id)), [clean])
  const [filter, setFilter] = useState<AssessmentFilter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { page, pageSize, pagination, onPaginationChange, resetPage } =
    useCurrentPagination()

  const rows = useMemo(() => {
    const problems = prioritizeTopProblems(getProblemSubscriptions())
    const base =
      filter === 'to_prepare'
        ? clean
        : filter === 'ready' || filter === 'skipped'
          ? []
          : filter === 'attention'
            ? problems
            : mockSubscriptions
    const normalized = query.trim().toLowerCase()
    return normalized
      ? base.filter((record) => matchesQuery(record, normalized))
      : base
  }, [clean, filter, query])

  const selectedReady = [...selected].filter((id) => cleanIds.has(id)).length
  const canPrepare =
    selectedReady === totals.clean && selected.size === totals.clean
  const headerState: HeaderCheckState =
    selectedReady === 0
      ? 'unchecked'
      : selectedReady === totals.clean
        ? 'checked'
        : 'indeterminate'

  const selectReady = () => {
    setSelected(new Set(clean.map((row) => row.id)))
    setFilter('to_prepare')
    setQuery('')
    resetPage()
  }

  const toggleAllReady = () => {
    if (selectedReady === totals.clean) {
      setSelected(new Set())
      return
    }
    selectReady()
  }

  const toggle = (id: string) => {
    if (!cleanIds.has(id)) {
      return
    }
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const columns = useMemo(
    () =>
      buildCurrentColumns({
        isSelectable: (id) => cleanIds.has(id),
        isSelected: (id) => selected.has(id),
        headerState,
        canSelectAll: totals.clean > 0,
        onToggle: toggle,
        onToggleAll: toggleAllReady,
      }),
    [cleanIds, headerState, selected, selectedReady, totals.clean],
  )

  const counts: Record<AssessmentFilter, number> = {
    all: totals.total,
    to_prepare: totals.clean,
    ready: 0,
    attention: totals.problems,
    skipped: 0,
  }

  const emptyMessage =
    filter === 'ready'
      ? 'No subscriptions are ready to switch yet.'
      : filter === 'skipped'
        ? 'Nothing is staying on Stripe permanently yet.'
        : query
          ? 'No subscriptions match this search.'
          : 'No subscriptions to show.'

  return (
    <Box as="section" flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          Assess &amp; import your catalog
        </Text>
        <Text variant="caption" color="muted">
          Preparing a subscription brings its customer and product to Polar.
          Polar starts billing only when you switch. {totals.clean} Ready ·{' '}
          {totals.problems} With problems.
        </Text>
      </Box>

      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="m"
        flexWrap="wrap"
      >
        <Box maxWidth="100%" overflowX="auto">
          <SegmentedControl
            value={filter}
            onChange={(next) => {
              setFilter(next as AssessmentFilter)
              resetPage()
            }}
            options={[
              { value: 'all', label: `All rows ${counts.all}` },
              { value: 'to_prepare', label: `To prepare ${counts.to_prepare}` },
              { value: 'ready', label: `Ready to switch ${counts.ready}` },
              {
                value: 'attention',
                label: `Needs attention ${counts.attention}`,
              },
              { value: 'skipped', label: `Won't import ${counts.skipped}` },
            ]}
          />
        </Box>
        <Box gap="s" flexWrap="wrap">
          <Button size="sm" variant="secondary" onClick={selectReady}>
            Select {totals.clean} ready
          </Button>
          <Button
            size="sm"
            onClick={() => act('assess')}
            disabled={!canPrepare}
          >
            {canPrepare
              ? `Prepare ${numberFormat.format(selectedReady)} subscriptions`
              : 'Prepare subscriptions'}
          </Button>
        </Box>
      </Box>

      {filter === 'attention' ? (
        <Box
          alignItems={{ base: 'start', md: 'center' }}
          justifyContent="between"
          gap="m"
          flexWrap="wrap"
        >
          <Text variant="caption" color="muted">
            Top requested problems first: missing country, existing Polar
            product, email identity conflict. All {totals.problems} problem rows
            are reachable across pages or search.
          </Text>
          <Box width={{ base: '100%', md: 280 }}>
            <Input
              aria-label="Search problem records"
              placeholder="Search problems"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                resetPage()
              }}
            />
          </Box>
        </Box>
      ) : null}

      <CurrentDataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={pageSize}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        emptyMessage={emptyMessage}
      />

      <Text variant="caption" color="muted">
        {selectedReady} of {totals.clean} ready selected across pages
      </Text>
    </Box>
  )
}
