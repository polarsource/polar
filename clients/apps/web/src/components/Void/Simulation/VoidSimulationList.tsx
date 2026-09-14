'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import {
  Button,
  DataTable,
  DataTableColumnDef,
  Status,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { changedLevers } from './baseline'
import { replay } from './engine'
import { deltaColor, shortDate, signedPct, signedUsd, usd } from './format'
import { useScenarios } from './store'
import { Scenario } from './types'

interface Row {
  id: string
  name: string
  description: string
  basedOn: string
  changes: number
  promotedAs: string | null
  baseline: number
  scenario: number
  expected: number
  up: number
  down: number
  atRisk: number
  updatedAt: string
}

const columns: DataTableColumnDef<Row>[] = [
  {
    accessorKey: 'name',
    enableSorting: false,
    header: 'Scenario',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column" minWidth={0}>
        <Box alignItems="center" columnGap="s">
          <Text truncate>{original.name}</Text>
          {original.promotedAs ? (
            <Status status={original.promotedAs} color="green" size="small" />
          ) : null}
        </Box>
        <Text truncate color="muted" variant="caption">
          {original.description ||
            `${original.changes} ${original.changes === 1 ? 'lever' : 'levers'} changed`}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'basedOn',
    enableSorting: false,
    header: 'Based on',
  },
  {
    accessorKey: 'scenario',
    enableSorting: false,
    header: 'Revenue / 30d',
    cell: ({ row: { original } }) => {
      const delta = original.scenario - original.baseline
      return (
        <Box flexDirection="column">
          <Text>{usd(original.scenario)}</Text>
          <Text color={deltaColor(delta)} variant="caption">
            {signedUsd(delta)} (
            {signedPct(
              original.baseline > 0 ? delta / original.baseline : null,
            )}
            )
          </Text>
        </Box>
      )
    },
  },
  {
    accessorKey: 'expected',
    enableSorting: false,
    header: 'Risk-adjusted',
    cell: ({ row: { original } }) => {
      const delta = original.expected - original.baseline
      return (
        <Box flexDirection="column">
          <Text>{usd(original.expected)}</Text>
          <Text color={deltaColor(delta)} variant="caption">
            {signedUsd(delta)}
          </Text>
        </Box>
      )
    },
  },
  {
    id: 'customers',
    enableSorting: false,
    header: 'Customers',
    cell: ({ row: { original } }) => (
      <Box flexDirection="column">
        <Text>
          {original.up} up, {original.down} down
        </Text>
        <Text
          color={original.atRisk > 0 ? 'warning' : 'muted'}
          variant="caption"
        >
          {original.atRisk > 0
            ? `${original.atRisk} at risk of churning`
            : 'None past tolerance'}
        </Text>
      </Box>
    ),
  },
  {
    accessorKey: 'updatedAt',
    enableSorting: false,
    header: 'Updated',
    cell: ({ getValue }) => shortDate(getValue() as string),
  },
]

const toRow = (scenario: Scenario): Row => {
  const { totals, counts } = replay(scenario.levers)
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    basedOn: `${scenario.basedOn.definition} · ${scenario.basedOn.version}`,
    changes: changedLevers(scenario.levers).length,
    promotedAs: scenario.promotedAs,
    baseline: totals.baseline,
    scenario: totals.scenario,
    expected: totals.expected,
    up: counts.up,
    down: counts.down,
    atRisk: counts.atRisk,
    updatedAt: scenario.updatedAt,
  }
}

export const VoidSimulationList = () => {
  const router = useRouter()
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}/definition/simulate`
  const { scenarios, create } = useScenarios()
  const rows = useMemo(() => scenarios.map(toRow), [scenarios])

  return (
    <DashboardBody
      title="Simulate"
      titleActions={
        <Button
          onClick={() => {
            const scenario = create(`Scenario ${scenarios.length + 1}`)
            router.push(`${base}/${scenario.id}`)
          }}
        >
          New scenario
        </Button>
      }
    >
      <Box flexDirection="column" rowGap="2xl">
        <Text color="muted">
          Branch the active definition, change its prices and allowances, and
          replay the last 30 days of real usage through it. Every number here is
          what customers would actually have been billed.
        </Text>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={false}
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(`${base}/${row.original.id}`)}
        />
      </Box>
    </DashboardBody>
  )
}
