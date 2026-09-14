'use client'

import { formatPercentage } from '@/utils/formatters'
import {
  DataTable,
  DataTableColumnDef,
  SegmentedControl,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { Delta } from './Delta'
import { shortDate, usd } from './format'
import { ScenarioChart } from './ScenarioChart'
import { SeriesLegend } from './SeriesLegend'
import { ComponentResult, ReplayResult } from './types'

type View = 'daily' | 'cumulative'

const columns: DataTableColumnDef<ComponentResult>[] = [
  {
    accessorKey: 'label',
    enableSorting: false,
    header: 'Component',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column">
        <Text>{original.label}</Text>
        <Text color="muted" variant="caption">
          {original.group}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'baseline',
    enableSorting: false,
    header: 'Baseline',
    cell: ({ getValue }) => usd(getValue() as number),
  },
  {
    accessorKey: 'scenario',
    enableSorting: false,
    header: 'Scenario',
    cell: ({ getValue }) => usd(getValue() as number),
  },
  {
    id: 'delta',
    enableSorting: false,
    header: 'Change',
    cell: ({ row: { original } }) => {
      const delta = original.scenario - original.baseline
      return <Delta delta={delta} />
    },
  },
]

export const ScenarioReplay = ({ result }: { result: ReplayResult }) => {
  const [view, setView] = useState<View>('daily')
  const { totals } = result

  const points = useMemo(() => {
    if (view === 'daily') return result.daily
    let baseline = 0
    let scenario = 0
    return result.daily.map((point) => {
      baseline += point.baseline
      scenario += point.scenario
      return { ...point, baseline, scenario }
    })
  }, [result.daily, view])

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box alignItems="baseline" justifyContent="between" columnGap="l">
        <Text variant="heading-xs" as="h2">
          Revenue
        </Text>
        <Text color="muted">Last 30 days</Text>
      </Box>

      <Box
        flexDirection="column"
        rowGap="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        padding="l"
      >
        <Box
          alignItems={{ base: 'start', md: 'center' }}
          justifyContent="between"
          flexDirection={{ base: 'column', md: 'row' }}
          gap="l"
        >
          <SeriesLegend values={totals} />
          <SegmentedControl<View>
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'cumulative', label: 'Cumulative' },
            ]}
          />
        </Box>
        <ScenarioChart
          data={points}
          keys={['baseline', 'scenario']}
          xAxisFormatter={shortDate}
        />
      </Box>

      <Box flexDirection="column" rowGap="l">
        <Box alignItems="baseline" justifyContent="between" columnGap="l">
          <Text variant="heading-xxs" as="h3">
            Breakdown
          </Text>
          <Text color="muted">
            {formatPercentage(
              totals.scenario > 0
                ? result.components
                    .filter((c) => c.group === 'Usage')
                    .reduce((sum, c) => sum + c.scenario, 0) / totals.scenario
                : 0,
            )}{' '}
            usage based
          </Text>
        </Box>
        <DataTable
          columns={columns}
          data={result.components}
          isLoading={false}
          getRowId={(row) => row.key}
        />
      </Box>
    </Box>
  )
}
