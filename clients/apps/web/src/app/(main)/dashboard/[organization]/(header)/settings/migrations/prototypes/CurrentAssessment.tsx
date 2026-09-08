'use client'

import { Button, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { MockSubscriptionRecord, mockSubscriptions } from './mockData'
import { PrototypeAction } from './model'
import { CurrentRecordRow } from './CurrentRecordList'
import { TOP_ISSUE_CODES } from './recordLabels'
import {
  getCleanSubscriptions,
  getInitialTotals,
  getProblemSubscriptions,
} from './selectors'

type AssessmentFilter = 'all' | 'to_prepare' | 'ready' | 'attention' | 'skipped'

const PAGE_SIZE = 10
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

function filterRows(filter: AssessmentFilter): MockSubscriptionRecord[] {
  const clean = getCleanSubscriptions()
  const problems = prioritizeTopProblems(getProblemSubscriptions())
  switch (filter) {
    case 'to_prepare':
      return clean
    case 'ready':
      return []
    case 'attention':
      return problems
    case 'skipped':
      return []
    default:
      return mockSubscriptions
  }
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
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const rows = filterRows(filter)
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedReady = [...selected].filter((id) => cleanIds.has(id)).length
  const canPrepare =
    selectedReady === totals.clean && selected.size === totals.clean

  const counts: Record<AssessmentFilter, number> = {
    all: totals.total,
    to_prepare: totals.clean,
    ready: 0,
    attention: totals.problems,
    skipped: 0,
  }

  const selectReady = () => {
    setSelected(new Set(clean.map((row) => row.id)))
    setFilter('to_prepare')
    setPage(1)
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
              setPage(1)
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
        <Text variant="caption" color="muted">
          Top requested problems first: missing country, existing Polar product,
          email identity conflict. All {totals.problems} problem rows are
          reachable across pages.
        </Text>
      ) : null}

      {pageRows.length === 0 ? (
        <Box
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="l"
          paddingVertical="2xl"
          justifyContent="center"
        >
          <Text variant="caption" color="muted">
            {filter === 'ready'
              ? 'No subscriptions are ready to switch yet.'
              : filter === 'skipped'
                ? 'Nothing is staying on Stripe permanently yet.'
                : 'No subscriptions to show.'}
          </Text>
        </Box>
      ) : (
        <Box
          as="ul"
          flexDirection="column"
          rowGap="s"
          aria-label="Assessment rows"
        >
          {pageRows.map((record) => (
            <CurrentRecordRow
              key={record.id}
              record={record}
              selectable={cleanIds.has(record.id)}
              selected={selected.has(record.id)}
              onToggle={() => toggle(record.id)}
              emphasize={
                filter === 'attention' &&
                TOP_ISSUE_CODES.includes(record.issueCode)
              }
            />
          ))}
        </Box>
      )}

      {rows.length > PAGE_SIZE ? (
        <Box alignItems="center" justifyContent="between" gap="m">
          <Text variant="caption" color="muted">
            Page {page} of {pageCount} · {selectedReady} of {totals.clean} ready
            selected across pages
          </Text>
          <Box gap="s">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
