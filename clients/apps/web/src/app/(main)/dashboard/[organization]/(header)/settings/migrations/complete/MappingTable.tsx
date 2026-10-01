'use client'

import {
  Button,
  DataTable,
  Input,
  SegmentedControl,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PaginationState } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { KIND_LABELS } from './completeCopy'
import { MAPPING_KINDS, MappingKind, MappingRow } from './idMapping'
import { buildMappingColumns } from './mappingColumns'
import { downloadMapping } from './mappingExport'
import { matchesQuery } from './mappingSearch'

const numberFormat = new Intl.NumberFormat('en-US')

interface Props {
  mapping: Record<MappingKind, MappingRow[]>
  organizationSlug: string
  showExport?: boolean
}

export function MappingTable({
  mapping,
  organizationSlug,
  showExport = true,
}: Props) {
  const [kind, setKind] = useState<MappingKind>('customers')
  const [query, setQuery] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const columns = useMemo(
    () => buildMappingColumns(organizationSlug),
    [organizationSlug],
  )
  const rows = useMemo(
    () => mapping[kind].filter((row) => matchesQuery(row, query)),
    [mapping, kind, query],
  )
  const start = pagination.pageIndex * pagination.pageSize
  const pageRows = rows.slice(start, start + pagination.pageSize)

  const resetPage = () =>
    setPagination((current) => ({ ...current, pageIndex: 0 }))

  return (
    <Box flexDirection="column" rowGap="m">
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="m"
        rowGap="s"
        flexWrap="wrap"
      >
        <Box maxWidth="100%" overflowX="auto">
          <SegmentedControl
            value={kind}
            onChange={(next) => {
              setKind(next as MappingKind)
              resetPage()
            }}
            options={MAPPING_KINDS.map((value) => ({
              value,
              label: `${KIND_LABELS[value]} ${numberFormat.format(mapping[value].length)}`,
            }))}
          />
        </Box>
        {showExport && (
          <Box columnGap="s">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadMapping(mapping, 'csv')}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadMapping(mapping, 'json')}
            >
              Export JSON
            </Button>
          </Box>
        )}
      </Box>

      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          resetPage()
        }}
        placeholder="Search by name, email, Stripe ID or Polar ID"
        preSlot={<Search size={14} />}
      />

      {rows.length === 0 ? (
        <Box
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="l"
          paddingVertical="2xl"
          justifyContent="center"
        >
          <Text variant="caption" color="muted">
            {query
              ? 'Nothing matches that search.'
              : `No ${KIND_LABELS[kind].toLowerCase()} in this migration.`}
          </Text>
        </Box>
      ) : (
        <DataTable
          columns={columns}
          data={pageRows}
          rowCount={rows.length}
          pageCount={Math.max(1, Math.ceil(rows.length / pagination.pageSize))}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={false}
          getRowId={(row) => `${row.kind}:${row.stripeId}:${row.detail ?? ''}`}
        />
      )}
    </Box>
  )
}
