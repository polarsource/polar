'use client'

import { Button, DataTable, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PaginationState } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { KIND_LABELS, STATE_LABELS } from '../completeCopy'
import { MAPPING_KINDS } from '../idMapping'
import { downloadMapping } from '../mappingExport'
import { matchesQuery } from '../mappingSearch'
import { kindStateMatrix } from '../viewModels'
import { KindStateMatrix, MatrixFilter } from './KindStateMatrix'
import { buildLedgerColumns } from './ledgerColumns'
import { LayoutProps, LeftOnStripeAlert, numberFormat } from './shared'

// Everything at once: every object in one table, sliced by a kind × status
// matrix. For the merchant (or their engineer) auditing the whole move.
export function LedgerLayout(props: LayoutProps) {
  const { report, mapping, organizationSlug } = props
  const [filter, setFilter] = useState<MatrixFilter>({
    kind: null,
    state: null,
  })
  const [query, setQuery] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const matrix = useMemo(() => kindStateMatrix(mapping), [mapping])
  const columns = useMemo(
    () => buildLedgerColumns(organizationSlug),
    [organizationSlug],
  )
  const rows = useMemo(
    () =>
      MAPPING_KINDS.flatMap((kind) =>
        filter.kind === null || filter.kind === kind ? mapping[kind] : [],
      ).filter(
        (row) =>
          (filter.state === null || row.state === filter.state) &&
          matchesQuery(row, query),
      ),
    [mapping, filter, query],
  )
  const start = pagination.pageIndex * pagination.pageSize
  const total = MAPPING_KINDS.reduce(
    (sum, kind) => sum + mapping[kind].length,
    0,
  )

  const facts = [
    `${numberFormat.format(report.moved)} billing on Polar`,
    `${numberFormat.format(report.pending)} ready`,
    `${numberFormat.format(report.skipped)} left on Stripe`,
    `${numberFormat.format(report.failed)} failed`,
    `${numberFormat.format(total)} objects`,
  ]

  return (
    <Box flexDirection="column" rowGap="l">
      <Box
        justifyContent="between"
        alignItems="center"
        flexWrap="wrap"
        rowGap="s"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text variant="heading-xxs" as="h2">
            Migration ledger
          </Text>
          <Text variant="caption" color="muted" tabularNums>
            {facts.join('  ·  ')}
          </Text>
        </Box>
        <Box columnGap="s">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => downloadMapping(mapping, 'csv')}
          >
            CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => downloadMapping(mapping, 'json')}
          >
            JSON
          </Button>
        </Box>
      </Box>

      <LeftOnStripeAlert {...props} />

      <KindStateMatrix
        matrix={matrix}
        filter={filter}
        onFilter={(next) => {
          setFilter(next)
          setPagination((current) => ({ ...current, pageIndex: 0 }))
        }}
      />

      <Box columnGap="m" alignItems="center">
        <Box flexGrow={1}>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPagination((current) => ({ ...current, pageIndex: 0 }))
            }}
            placeholder="Filter by name, email, Stripe ID or Polar ID"
            preSlot={<Search size={14} />}
          />
        </Box>
        <Text variant="caption" color="muted" tabularNums>
          {filter.kind || filter.state
            ? `${[filter.kind && KIND_LABELS[filter.kind], filter.state && STATE_LABELS[filter.state]].filter(Boolean).join(' · ')}: `
            : ''}
          {numberFormat.format(rows.length)} rows
        </Text>
      </Box>

      <DataTable
        columns={columns}
        data={rows.slice(start, start + pagination.pageSize)}
        rowCount={rows.length}
        pageCount={Math.max(1, Math.ceil(rows.length / pagination.pageSize))}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={false}
        getRowId={(row) => `${row.kind}:${row.stripeId}:${row.detail ?? ''}`}
      />
    </Box>
  )
}
