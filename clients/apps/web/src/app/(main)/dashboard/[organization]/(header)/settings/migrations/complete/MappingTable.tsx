'use client'

import {
  Button,
  DataTable,
  DataTableColumnDef,
  Input,
  SegmentedControl,
  Status,
  StatusColor,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowUpRight, Copy, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  IdMapping,
  MAPPING_KINDS,
  MappingKind,
  MappingRow,
  MappingState,
} from './idMapping'
import { downloadMapping } from './mappingExport'

const numberFormat = new Intl.NumberFormat('en-US')

const KIND_LABELS: Record<MappingKind, string> = {
  customers: 'Customers',
  products: 'Products',
  prices: 'Prices',
  discounts: 'Discounts',
  subscriptions: 'Subscriptions',
}

// Same treatment as the switch table: neutral unless something needs a look.
const STATES: Record<MappingState, { label: string; color?: StatusColor }> = {
  moved: { label: 'Switched' },
  in_polar: { label: 'In Polar' },
  ready: { label: 'Ready' },
  left_on_stripe: { label: 'Left on Stripe', color: 'yellow' },
  failed: { label: 'Failed', color: 'red' },
  not_imported: { label: 'Not imported' },
}

const RESOURCE_PATHS: Partial<Record<MappingKind, string>> = {
  customers: 'customers',
  products: 'products',
  subscriptions: 'sales/subscriptions',
}

function CopyableId({ value }: { value: string }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      columnGap="xs"
      minWidth={0}
      cursor={{ hover: 'pointer' }}
      color={{ base: 'text-primary', hover: 'text-secondary' }}
      title="Copy"
      onClick={() => navigator.clipboard.writeText(value)}
    >
      <Text variant="caption" monospace truncate color="inherit">
        {value}
      </Text>
      <Copy size={12} />
    </Box>
  )
}

function PolarIdCell({
  row,
  organizationSlug,
}: {
  row: MappingRow
  organizationSlug: string
}) {
  if (!row.polarId) {
    return (
      <Text variant="caption" color="muted">
        {row.state === 'in_polar' ? 'Not found' : 'On Stripe'}
      </Text>
    )
  }
  const path = RESOURCE_PATHS[row.kind]
  return (
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <CopyableId value={row.polarId} />
      {path && (
        <Link href={`/dashboard/${organizationSlug}/${path}/${row.polarId}`}>
          <Box
            color={{ base: 'text-tertiary', hover: 'text-primary' }}
            title="Open in Polar"
          >
            <ArrowUpRight size={14} />
          </Box>
        </Link>
      )}
    </Box>
  )
}

const columns = (
  organizationSlug: string,
): DataTableColumnDef<MappingRow>[] => [
  {
    id: 'name',
    size: 240,
    header: 'Name',
    cell: ({ row }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text truncate>{row.original.label}</Text>
        {row.original.detail && (
          <Text variant="caption" color="muted" truncate>
            {row.original.detail}
          </Text>
        )}
      </Box>
    ),
  },
  {
    id: 'stripe',
    size: 240,
    header: 'Stripe ID',
    cell: ({ row }) => <CopyableId value={row.original.stripeId} />,
  },
  {
    id: 'polar',
    size: 330,
    header: 'Polar ID',
    cell: ({ row }) => (
      <PolarIdCell row={row.original} organizationSlug={organizationSlug} />
    ),
  },
  {
    id: 'status',
    size: 140,
    header: 'Status',
    cell: ({ row }) => (
      <Status
        size="small"
        status={STATES[row.original.state].label}
        color={STATES[row.original.state].color}
      />
    ),
  },
]

export function MappingTable({
  mapping,
  organizationSlug,
}: {
  mapping: IdMapping
  organizationSlug: string
}) {
  const [kind, setKind] = useState<MappingKind>('customers')
  const [query, setQuery] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const tableColumns = useMemo(
    () => columns(organizationSlug),
    [organizationSlug],
  )
  const needle = query.trim().toLowerCase()
  const rows = mapping[kind].filter((row) =>
    [row.stripeId, row.polarId, row.label, row.detail].some((value) =>
      value?.toLowerCase().includes(needle),
    ),
  )
  const start = pagination.pageIndex * pagination.pageSize
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
      <DataTable
        columns={tableColumns}
        data={rows.slice(start, start + pagination.pageSize)}
        rowCount={rows.length}
        pageCount={Math.max(1, Math.ceil(rows.length / pagination.pageSize))}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={false}
        getRowId={(row) => `${row.stripeId}:${row.detail ?? ''}`}
      />
    </Box>
  )
}
