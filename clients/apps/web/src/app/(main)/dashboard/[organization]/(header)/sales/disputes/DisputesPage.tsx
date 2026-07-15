'use client'

import { DisputeStatusSelect } from '@/components/Disputes/DisputeStatusSelect'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useSupportCases } from '@/hooks/queries/supportCases'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import {
  type DisputeStatusFilter,
  getDisputeDisplayStatus,
  getDisputeReasonDisplay,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Status, Text, Truncated } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useRouter } from 'next/navigation'
import React from 'react'

interface Props {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  status?: DisputeStatusFilter
}

const DisputesPage = ({
  organization,
  pagination,
  sorting,
  status = 'any',
}: Props) => {
  const router = useRouter()

  const buildUrl = (
    nextPagination: DataTablePaginationState,
    nextSorting: DataTableSortingState,
    nextStatus: DisputeStatusFilter,
  ) => {
    const params = serializeSearchParams(nextPagination, nextSorting)
    if (nextStatus !== 'any') {
      params.append('status', nextStatus)
    }
    return `/dashboard/${organization.slug}/sales/disputes?${params}`
  }

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updated =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue
    router.push(buildUrl(updated, sorting, status))
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updated =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue
    router.push(buildUrl(pagination, updated, status))
  }

  const setStatus = (value: DisputeStatusFilter) => {
    router.push(buildUrl(pagination, sorting, value))
  }

  const { data: supportCases, isLoading } = useSupportCases(organization.id, {
    ...getAPIParams(pagination, sorting),
    type: 'dispute',
    dispute_status: status === 'any' ? undefined : [status],
  })

  const disputes = (supportCases?.items ?? []).flatMap((item) =>
    item.type === 'dispute' ? [item.dispute] : [],
  )
  const rowCount = supportCases?.pagination.total_count ?? 0
  const pageCount = supportCases?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<schemas['Dispute']>[] = [
    {
      accessorKey: 'customer',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Truncated>
          <Text>{dispute.customer.name || dispute.customer.email}</Text>
        </Truncated>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: dispute } }) => {
        const { title, color } = getDisputeDisplayStatus(dispute)
        return <Status status={title} color={color} size="small" />
      },
    },
    {
      accessorKey: 'reason',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reason" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Text color="muted">{getDisputeReasonDisplay(dispute.reason)}</Text>
      ),
    },
    {
      accessorKey: 'amount',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Text>
          {formatCurrency('standard')(dispute.amount, dispute.currency)}
        </Text>
      ),
    },
    {
      accessorKey: 'evidence_due_by',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Respond by" />
      ),
      cell: ({ row: { original: dispute } }) => {
        if (!dispute.evidence_due_by) {
          return <Text color="muted">—</Text>
        }
        if (dispute.past_due) {
          return <Text color="danger">Overdue</Text>
        }
        return <FormattedDateTime datetime={dispute.evidence_due_by} />
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Opened" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <FormattedDateTime datetime={dispute.created_at} />
      ),
    },
  ]

  return (
    <DashboardBody wide title="Disputes">
      <Box flexDirection="column" rowGap="l">
        <Box alignItems="center" columnGap="m">
          <Box width={220}>
            <DisputeStatusSelect value={status} onChange={setStatus} />
          </Box>
        </Box>
        <DataTable
          columns={columns}
          data={disputes}
          rowCount={rowCount}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={isLoading}
          getRowId={(row) => row.id}
          onRowClick={(row) =>
            router.push(
              `/dashboard/${organization.slug}/sales/disputes/${row.original.id}`,
            )
          }
        />
      </Box>
    </DashboardBody>
  )
}

export default DisputesPage
