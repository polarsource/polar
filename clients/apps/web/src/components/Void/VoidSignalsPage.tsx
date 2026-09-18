'use client'

import { LoadingBox } from '@/components/Shared/LoadingBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { DataTable, DataTableColumnDef, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { VoidConfigSignal } from './api'
import { useVoidSignals } from './signalQueries'
import {
  formatSignalWindow,
  SIGNAL_KIND,
  signalEnters,
  signalExits,
  signalHref,
} from './signals'
import { VoidDetailShell, VoidErrorBox } from './VoidShell'

const signalColumns: DataTableColumnDef<VoidConfigSignal>[] = [
  {
    accessorKey: 'slug',
    enableSorting: false,
    header: 'Signal',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Text>{original.slug}</Text>
        <Text color="muted" variant="caption">
          {original.meter}
        </Text>
      </Box>
    ),
  },
  {
    id: 'kind',
    enableSorting: false,
    header: 'Kind',
    cell: ({ row: { original } }) => (
      <Status
        status={SIGNAL_KIND[original.kind].label}
        color={SIGNAL_KIND[original.kind].color}
        size="small"
      />
    ),
  },
  {
    id: 'fires',
    enableSorting: false,
    header: 'Enters',
    cell: ({ row: { original } }) => signalEnters(original),
  },
  {
    id: 'clears',
    enableSorting: false,
    header: 'Exits',
    cell: ({ row: { original } }) => signalExits(original),
  },
  {
    id: 'window',
    enableSorting: false,
    header: 'Window',
    cell: ({ row: { original } }) =>
      original.kind === 'semantic' ? formatSignalWindow(original.over) : '—',
  },
]

export const VoidSignalsPage = () => {
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const router = useRouter()
  const { signals, loading, error } = useVoidSignals()
  const semantic = signals.filter((signal) => signal.kind === 'semantic').length

  return (
    <VoidDetailShell title="Signals">
      {loading ? (
        <LoadingBox height={128} borderRadius="m" />
      ) : error ? (
        <VoidErrorBox message={error.message} />
      ) : (
        <Box flexDirection="column" rowGap="3xl">
          <Box
            display={{ base: 'grid', xl: 'flex' }}
            gridTemplateColumns="repeat(2, 1fr)"
            gap={{ base: 'l', md: 'xl' }}
          >
            <StatisticCard title="Signals" size="lg" valueClassName="font-sans">
              {signals.length}
            </StatisticCard>
            <StatisticCard
              title="Semantic"
              size="lg"
              valueClassName="font-sans"
            >
              {semantic}
            </StatisticCard>
            <StatisticCard title="Meter" size="lg" valueClassName="font-sans">
              {signals.length - semantic}
            </StatisticCard>
          </Box>
          {signals.length === 0 ? (
            <Box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              paddingVertical="3xl"
              rowGap="l"
            >
              <Text color="muted">No signals in this version</Text>
            </Box>
          ) : (
            <DataTable
              columns={signalColumns}
              data={signals}
              isLoading={false}
              getRowId={(row) => row.slug}
              onRowClick={(row) =>
                router.push(signalHref(base, row.original.slug))
              }
            />
          )}
        </Box>
      )}
    </VoidDetailShell>
  )
}
