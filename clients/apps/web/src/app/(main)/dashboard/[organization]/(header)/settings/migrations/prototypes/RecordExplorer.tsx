'use client'

import { Input, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import {
  IssueCode,
  MockSubscriptionRecord,
  SubscriptionCategory,
  mockSubscriptions,
} from './mockData'
import { Metric, Surface } from './PrototypePrimitives'
import { RecordRow } from './RecordRow'
import { TOP_ISSUE_CODES } from './recordLabels'
import {
  getInitialTotals,
  getProblemSubscriptions,
  getRepresentativeSubscriptions,
} from './selectors'

type ExplorerMode = 'summary' | 'all'
type CategoryFilter = 'all' | Exclude<SubscriptionCategory, 'clean'>

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'customer', label: 'Customer' },
  { value: 'identity', label: 'Identity' },
  { value: 'product', label: 'Product' },
  { value: 'payment', label: 'Payment' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'cutover', label: 'Cutover' },
]

function problemByCode(code: IssueCode): MockSubscriptionRecord | undefined {
  return getProblemSubscriptions().find((record) => record.issueCode === code)
}

function summaryRecords(): MockSubscriptionRecord[] {
  const top = TOP_ISSUE_CODES.map(problemByCode).filter(
    (record): record is MockSubscriptionRecord => record != null,
  )
  const topIds = new Set(top.map((record) => record.id))
  const extras = getRepresentativeSubscriptions()
    .filter((item) => !item.canarySelectable && !topIds.has(item.id))
    .map((item) => mockSubscriptions.find((record) => record.id === item.id))
    .filter((record): record is MockSubscriptionRecord => record != null)
  return [...top, ...extras]
}

export function RecordExplorer({
  transferred = false,
  title = 'Subscription catalog',
  defaultMode = 'summary',
}: {
  transferred?: boolean
  title?: string
  defaultMode?: ExplorerMode
}) {
  const totals = getInitialTotals()
  const [mode, setMode] = useState<ExplorerMode>(defaultMode)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')

  const problems = getProblemSubscriptions().filter((record) => {
    if (category !== 'all' && record.category !== category) {
      return false
    }
    if (!query.trim()) {
      return true
    }
    const haystack = [
      record.customerLabel,
      record.customerEmail ?? '',
      record.planLabel,
      record.title,
      record.issueCode,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  const visible = mode === 'summary' ? summaryRecords() : problems

  return (
    <Surface>
      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="m"
        flexDirection={{ base: 'column', md: 'row' }}
      >
        <Text variant="heading-xs" as="h3">
          {title}
        </Text>
        <Box aria-label="Catalog view mode">
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'summary', label: 'Summary' },
              { value: 'all', label: 'All problems' },
            ]}
          />
        </Box>
      </Box>
      <Box gap="xl" flexWrap="wrap">
        <Metric label="Ready" value={totals.clean} />
        <Metric label="With problems" value={totals.problems} />
        <Metric label="Total catalog" value={totals.total} />
      </Box>
      {mode === 'all' ? (
        <Box flexDirection="column" rowGap="s">
          <Text variant="label" as="label" htmlFor="prototype-record-filter">
            Filter records
          </Text>
          <Input
            id="prototype-record-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Customer, plan, or issue"
            aria-label="Filter problem records"
          />
          <Box aria-label="Filter by problem category">
            <SegmentedControl
              size="sm"
              value={category}
              onChange={setCategory}
              options={CATEGORY_FILTERS}
            />
          </Box>
        </Box>
      ) : (
        <Text color="muted">
          Top issues first: missing country, existing Polar product, and
          customer identity conflict. Switch to all problems for the full set.
        </Text>
      )}
      <Box as="ul" flexDirection="column" rowGap="s" aria-label={title}>
        {visible.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            transferred={transferred}
            emphasize={TOP_ISSUE_CODES.includes(record.issueCode)}
          />
        ))}
      </Box>
      {mode === 'all' && visible.length === 0 ? (
        <Text color="muted">No records match this filter.</Text>
      ) : null}
    </Surface>
  )
}
