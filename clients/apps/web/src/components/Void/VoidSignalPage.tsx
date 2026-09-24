'use client'

import { EmptyState } from '@/components/Shared/EmptyState'
import { LoadingBox } from '@/components/Shared/LoadingBox'
import { StatisticCard } from '@/components/Shared/StatisticCard'
import { CodeBlock } from '@/components/SyntaxHighlighterShiki/CodeBlock'
import SensorsOutlined from '@mui/icons-material/SensorsOutlined'
import { DataTable, DataTableColumnDef, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { VoidConfigSignal } from './api'
import {
  signalDefinition,
  signalThresholds,
  signalUsage,
  ThresholdRow,
} from './signalExplain'
import { useVoidSignals } from './signalQueries'
import {
  formatSignalWindow,
  SIGNAL_KIND,
  signalEnters,
  signalExits,
} from './signals'
import { TableSection } from './VoidIdentityTables'
import { VoidDetailShell, VoidErrorBox } from './VoidShell'
import { VoidSignalHysteresis } from './VoidSignalHysteresis'

const thresholdColumns: DataTableColumnDef<ThresholdRow>[] = [
  {
    accessorKey: 'key',
    enableSorting: false,
    header: 'Field',
    cell: ({ getValue }) => (
      <Text monospace variant="caption">
        {getValue() as string}
      </Text>
    ),
  },
  {
    accessorKey: 'value',
    enableSorting: false,
    header: 'Value',
    cell: ({ getValue }) => <Text monospace>{getValue() as string}</Text>,
  },
  {
    accessorKey: 'effect',
    enableSorting: false,
    header: 'Effect',
    cell: ({ getValue }) => (
      <Text color="muted" wrap="pretty">
        {getValue() as string}
      </Text>
    ),
  },
]

export const VoidSignalPage = ({ slug }: { slug: string }) => {
  const { signals, loading, error } = useVoidSignals()
  const signal = signals.find((candidate) => candidate.slug === slug)

  if (loading || error || !signal) {
    return (
      <VoidDetailShell title="Signal">
        {loading ? (
          <LoadingBox height={128} borderRadius="m" />
        ) : error ? (
          <VoidErrorBox message={error.message} />
        ) : (
          <EmptyState
            icon={<SensorsOutlined fontSize="inherit" />}
            title="Unknown signal"
            description="No signal with this slug exists in the active version."
          />
        )}
      </VoidDetailShell>
    )
  }

  const caption = [SIGNAL_KIND[signal.kind].label, signal.meter]
  if (signal.kind === 'semantic') caption.push(formatSignalWindow(signal.over))

  return (
    <VoidDetailShell title={signal.slug} caption={caption.join(' · ')}>
      <Box flexDirection="column" rowGap="3xl">
        <Stats signal={signal} />
        {signal.kind === 'semantic' ? (
          <TableSection title="Question" caption="Asked once per window">
            <Box
              padding="l"
              borderRadius="m"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Text>“{signal.when}”</Text>
            </Box>
          </TableSection>
        ) : null}
        <TableSection title="Hysteresis" caption="Two thresholds, no flapping">
          <VoidSignalHysteresis signal={signal} />
        </TableSection>
        <TableSection title="Fields">
          <DataTable
            columns={thresholdColumns}
            data={signalThresholds(signal)}
            isLoading={false}
            getRowId={(row) => row.key}
          />
        </TableSection>
        <TableSection title="Definition" caption="From your Void config">
          <CodeBlock code={signalDefinition(signal)} />
        </TableSection>
        <TableSection title="Reading it" caption="Evaluated client-side">
          <CodeBlock code={signalUsage(signal)} />
        </TableSection>
      </Box>
    </VoidDetailShell>
  )
}

const Stats = ({ signal }: { signal: VoidConfigSignal }) => (
  <Box
    display={{ base: 'grid', xl: 'flex' }}
    gridTemplateColumns="repeat(2, 1fr)"
    gap={{ base: 'l', md: 'xl' }}
  >
    <StatisticCard title="Enters" size="lg" valueClassName="font-sans">
      {signalEnters(signal)}
    </StatisticCard>
    <StatisticCard title="Exits" size="lg" valueClassName="font-sans">
      {signalExits(signal)}
    </StatisticCard>
    <StatisticCard title="Meter" size="lg" valueClassName="font-sans">
      {signal.meter}
    </StatisticCard>
    {signal.kind === 'semantic' ? (
      <StatisticCard title="Window" size="lg" valueClassName="font-sans">
        {formatSignalWindow(signal.over)}
      </StatisticCard>
    ) : null}
  </Box>
)
