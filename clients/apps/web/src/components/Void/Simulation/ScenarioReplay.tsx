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
import { deltaColor, shortDate, signedPct, signedUsd, usd } from './format'
import { ScenarioChart } from './ScenarioChart'
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
      return <Text color={deltaColor(delta)}>{signedUsd(delta)}</Text>
    },
  },
]

export const ScenarioReplay = ({ result }: { result: ReplayResult }) => {
  const [view, setView] = useState<View>('daily')
  const { totals, counts } = result
  const delta = totals.scenario - totals.baseline
  const ratio = totals.baseline > 0 ? delta / totals.baseline : null
  const expectedDelta = totals.expected - totals.baseline

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
      <Box flexDirection="column" rowGap="s">
        <Text variant="heading-xs" as="h2">
          Revenue would have been {usd(totals.scenario)}, {signedPct(ratio)}{' '}
          against {usd(totals.baseline)}
        </Text>
        <Text color="muted">
          Rebilled from the last 30 days of real usage. After expected churn,{' '}
          {usd(totals.expected)} ({signedUsd(expectedDelta)}). {counts.up}{' '}
          customers pay more, {counts.down} pay less
          {counts.atRisk > 0
            ? `, ${counts.atRisk} above the churn tolerance.`
            : '.'}
        </Text>
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
        <Box alignItems="center" justifyContent="between" columnGap="l">
          <Text color="muted" variant="caption">
            Revenue per day, baseline against scenario
          </Text>
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
          keys={[
            { key: 'baseline', label: 'Baseline' },
            { key: 'scenario', label: 'Scenario' },
          ]}
          xAxisFormatter={shortDate}
        />
      </Box>

      <Box flexDirection="column" rowGap="l">
        <Box alignItems="baseline" justifyContent="between" columnGap="l">
          <Text variant="title" as="h3">
            Where the change comes from
          </Text>
          <Text color="muted" variant="caption">
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
