'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { useClientSidePagination } from '@/hooks/useClientSidePagination'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import {
  Avatar,
  DataTable,
  DataTableColumnDef,
  Input,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useContext, useDeferredValue, useMemo, useState } from 'react'
import {
  buildTree,
  describeKinds,
  rollupUsage,
  shortDate,
  walk,
} from './identities'
import { getVoidData } from './mock'

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

interface Row {
  id: string
  name: string
  kind: string
  makeup: string
  members: { name: string; kind: string; text: string }[]
  haystack: string
  usage: number
  spend: number
  orders: number
  created_at: string
}

const searchable = (identity: { name: string; id: string; kind: string }) =>
  `${identity.name} ${identity.id} ${identity.kind}`.toLowerCase()

const columns: DataTableColumnDef<Row & { detail: string }>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Identity',
    cell: ({ row: { original } }) => (
      <Box alignItems="center" columnGap="m" minWidth={0}>
        <Avatar className="h-8 w-8" avatar_url={null} name={original.name} />
        <Box flexDirection="column" minWidth={0}>
          <Text truncate>{original.name}</Text>
          <Text truncate color="muted" variant="caption">
            {original.detail}
          </Text>
        </Box>
      </Box>
    ),
  },
  {
    accessorKey: 'usage',
    enableSorting: false,
    header: 'Usage / 30d',
    cell: ({ getValue }) => usd(getValue() as number),
  },
  {
    accessorKey: 'spend',
    enableSorting: false,
    header: 'Paid / 30d',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column">
        <Text>{usd(original.spend)}</Text>
        <Text color="muted" variant="caption">
          {original.orders} {original.orders === 1 ? 'order' : 'orders'}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'created_at',
    enableSorting: false,
    header: 'First seen',
    cell: ({ getValue }) => shortDate(getValue() as string),
  },
]

export const VoidIdentitiesPage = () => {
  const router = useRouter()
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const data = useMemo(() => getVoidData(), [])
  const tree = useMemo(() => buildTree(data.identities), [data])
  const rolled = useMemo(() => rollupUsage(tree), [tree])

  const rows = useMemo<Row[]>(
    () =>
      [...tree.roots]
        .sort(
          (a, b) =>
            b.identity.spend - a.identity.spend ||
            rolled[b.identity.id] - rolled[a.identity.id],
        )
        .map((node) => {
          const { identity } = node
          const below = walk(node).slice(1)
          const members = below.map((member) => ({
            name: member.identity.name,
            kind: member.identity.kind,
            text: searchable(member.identity),
          }))
          return {
            id: identity.id,
            name: identity.name,
            kind: identity.kind,
            makeup:
              below.length > 0
                ? describeKinds(below.map((member) => member.identity))
                : identity.kind,
            members,
            haystack: [
              searchable(identity),
              ...members.map((m) => m.text),
            ].join('\n'),
            usage: rolled[identity.id],
            spend: identity.spend,
            orders: identity.orders,
            created_at: identity.created_at,
          }
        }),
    [tree, rolled],
  )

  const [query, setQuery] = useState('')
  const needle = useDeferredValue(query).trim().toLowerCase()
  const visible = useMemo(
    () =>
      rows
        .filter((row) => !needle || row.haystack.includes(needle))
        .map((row) => {
          const hit = needle
            ? row.members.find((member) => member.text.includes(needle))
            : undefined
          return {
            ...row,
            detail: hit ? `matches ${hit.name} (${hit.kind})` : row.makeup,
          }
        }),
    [rows, needle],
  )

  const { pageItems, pagination, setPagination, rowCount, pageCount } =
    useClientSidePagination(visible)

  const makeup = describeKinds(
    data.identities.filter((identity) => identity.parent_id !== null),
  )

  return (
    <DashboardBody title="Identities">
      <Box flexDirection="column" rowGap="2xl">
        <Box
          flexDirection={{ base: 'column', md: 'row' }}
          alignItems={{ md: 'center' }}
          justifyContent="between"
          rowGap="l"
          columnGap="xl"
        >
          <Text color="muted">
            {tree.roots.length} customers, made up of {makeup}
          </Text>
          <Box width={{ base: '100%', md: 320 }}>
            <Input
              preSlot={<Search size={16} />}
              placeholder="Search customers, members, agents"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Box>
        </Box>
        {visible.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No identities match"
            description={`Nothing in the tree matches “${needle}”.`}
          />
        ) : (
          <DataTable
            columns={columns}
            data={pageItems}
            isLoading={false}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            getRowId={(row) => row.id}
            onRowClick={(row) =>
              router.push(`${base}/identities/${row.original.id}`)
            }
          />
        )}
      </Box>
    </DashboardBody>
  )
}
