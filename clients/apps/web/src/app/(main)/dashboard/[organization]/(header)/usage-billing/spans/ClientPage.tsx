'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useEventHierarchyStats } from '@/hooks/queries/events'
import {
  DataTableSortingState,
  parseSearchParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

const formatCost = (value: string | undefined): string => {
  if (!value) return '$0.00'
  const numValue = parseFloat(value)
  return `$${numValue.toFixed(3)}`
}

const formatOccurrences = (value: number): string => {
  return value.toLocaleString('en-US')
}

interface ClientPageProps {
  organization: schemas['Organization']
}

export default function ClientPage({ organization }: ClientPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { sorting: costSorting, setSorting: setCostSorting } =
    parseSearchParams(searchParams)

  const sortingParam = useMemo(() => {
    if (costSorting.length === 0) return ['-total']
    return costSorting.map((s) => (s.desc ? `-${s.id}` : s.id))
  }, [costSorting])

  const { data: costData, isLoading: costDataLoading } =
    useEventHierarchyStats(organization.id, ['_cost.amount'], sortingParam)

  return (
    <DashboardBody title="Spans" wide>
      <div className="flex flex-col gap-y-6">
        <h3 className="text-2xl">Event Costs</h3>
        <DataTable
          data={costData || []}
          isLoading={costDataLoading}
          sorting={costSorting}
          onSortingChange={(updaterOrValue) => {
            const updatedSorting =
              typeof updaterOrValue === 'function'
                ? updaterOrValue(costSorting)
                : updaterOrValue

            const sortingParams = serializeSearchParams(
              { pageIndex: 0, pageSize: 100 },
              updatedSorting,
            )
            router.push(
              `/dashboard/${organization.slug}/usage-billing/spans?${sortingParams}`,
            )
          }}
          onRowClick={(row) => {
            const eventName = encodeURIComponent(row.original.name)
            router.push(
              `/dashboard/${organization.slug}/usage-billing/spans/foo?eventName=${eventName}`,
            )
          }}
          columns={
            [
              {
                accessorKey: 'name',
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Name" />
                ),
                cell: ({ row }) => (
                  <span className="font-medium">{row.original.name}</span>
                ),
              },
              {
                id: 'total',
                accessorFn: (row) => row.totals?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Total Cost" />
                ),
                cell: ({ row }) =>
                  formatCost(row.original.totals?.['_cost_amount']),
              },
              {
                accessorKey: 'occurrences',
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader
                    column={column}
                    title="Occurrences"
                  />
                ),
                cell: ({ row }) =>
                  formatOccurrences(row.original.occurrences),
              },
              {
                id: 'average',
                accessorFn: (row) => row.averages?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader
                    column={column}
                    title="Average Cost"
                  />
                ),
                cell: ({ row }) =>
                  formatCost(row.original.averages?.['_cost_amount']),
              },
              {
                id: 'p95',
                accessorFn: (row) => row.p95?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="p95 Cost" />
                ),
                cell: ({ row }) =>
                  formatCost(row.original.p95?.['_cost_amount']),
              },
              {
                id: 'p99',
                accessorFn: (row) => row.p99?.['_cost_amount'],
                enableSorting: true,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="p99 Cost" />
                ),
                cell: ({ row }) =>
                  formatCost(row.original.p99?.['_cost_amount']),
              },
            ] as DataTableColumnDef<schemas['EventHierarchyStats']>[]
          }
        />
      </div>
    </DashboardBody>
  )
}
