'use client'

import { formatCurrency } from '@polar-sh/currency'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { IdentityNode, walk } from './identities'
import { VoidIdentity } from './types'

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

interface TreeRow {
  identity: VoidIdentity
  depth: number
  own: number
  rolled: number
  share: number
}

const columns: DataTableColumnDef<TreeRow>[] = [
  {
    id: 'identity',
    enableSorting: false,
    header: 'Identity',
    cell: ({ row: { original } }) => (
      <Box
        alignItems="center"
        columnGap="m"
        minWidth={0}
        paddingLeft={original.depth === 0 ? undefined : '2xl'}
      >
        <Box flexDirection="column" minWidth={0}>
          <Text truncate>{original.identity.name}</Text>
          {original.identity.note ? (
            <Text truncate color="muted" variant="caption">
              {original.identity.note}
            </Text>
          ) : null}
        </Box>
      </Box>
    ),
  },
  {
    id: 'kind',
    enableSorting: false,
    header: 'Kind',
    cell: ({ row: { original } }) => (
      <Text color="muted">{original.identity.kind}</Text>
    ),
  },
  {
    id: 'own',
    enableSorting: false,
    header: 'Own / 30d',
    cell: ({ row: { original } }) => usd(original.own),
  },
  {
    id: 'rolled',
    enableSorting: false,
    header: 'Rolled up',
    cell: ({ row: { original } }) => usd(original.rolled),
  },
  {
    id: 'share',
    enableSorting: false,
    header: 'Share',
    cell: ({ row: { original } }) => (
      <Box alignItems="center" columnGap="m">
        <Box
          width={96}
          height={4}
          borderRadius="full"
          backgroundColor="background-card"
          overflow="hidden"
        >
          <Box
            width={`${Math.round(original.share * 100)}%`}
            height="100%"
            backgroundColor="background-inverse"
          />
        </Box>
        <Text color="muted" variant="caption">
          {Math.round(original.share * 100)}%
        </Text>
      </Box>
    ),
  },
]

export const VoidIdentityTree = ({
  root,
  focusedId,
  rolled,
  base,
}: {
  root: IdentityNode
  focusedId: string
  rolled: Record<string, number>
  base: string
}) => {
  const router = useRouter()
  const rows = useMemo<TreeRow[]>(() => {
    const total = rolled[root.identity.id] || 1
    return walk(root).map((node) => ({
      identity: node.identity,
      depth: node.depth,
      own: node.identity.usage,
      rolled: rolled[node.identity.id],
      share: rolled[node.identity.id] / total,
    }))
  }, [root, rolled])

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={false}
      getRowId={(row) => row.identity.id}
      isRowActive={(row) => row.original.identity.id === focusedId}
      onRowClick={(row) =>
        router.push(`${base}/identities/${row.original.identity.id}`)
      }
    />
  )
}
