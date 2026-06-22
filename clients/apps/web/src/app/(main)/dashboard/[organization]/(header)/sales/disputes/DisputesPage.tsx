'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  MOCK_DISPUTES,
  type MockDispute,
} from '@/components/Disputes/mockDisputes'
import {
  DisputeStatusDisplayColor,
  DisputeStatusDisplayTitle,
  getDisputeReasonDescription,
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
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

const DisputesPage: React.FC<Props> = ({ organization }) => {
  const router = useRouter()

  const columns: DataTableColumnDef<MockDispute>[] = [
    {
      accessorKey: 'customer',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Truncated>
          <Text>{dispute.customer_email}</Text>
        </Truncated>
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Text>{formatCurrency('standard')(dispute.amount, dispute.currency)}</Text>
      ),
    },
    {
      accessorKey: 'reason',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reason" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Truncated>
          <Text color="muted">
            {getDisputeReasonDescription(dispute.reason)}
          </Text>
        </Truncated>
      ),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <Status
          status={DisputeStatusDisplayTitle[dispute.status]}
          color={DisputeStatusDisplayColor[dispute.status]}
          size="small"
        />
      ),
    },
    {
      accessorKey: 'next_action',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Respond by" />
      ),
      cell: ({ row: { original: dispute } }) => {
        if (dispute.status !== 'needs_response' || !dispute.evidence_due_by) {
          return <Text color="muted">—</Text>
        }
        return (
          <Text color={dispute.past_due ? 'danger' : 'default'}>
            {dispute.past_due ? 'Overdue' : formatDate(dispute.evidence_due_by)}
          </Text>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Opened" />
      ),
      cell: ({ row: { original: dispute } }) => (
        <FormattedDateTime datetime={dispute.created_at} />
      ),
    },
  ]

  return (
    <DashboardBody wide>
      <Box flexDirection="column" rowGap="xl">
        <Text color="muted">
          Disputes raised by buyers against your payments. Open one to see your
          next action.
        </Text>
        <DataTable
          columns={columns}
          data={MOCK_DISPUTES}
          rowCount={MOCK_DISPUTES.length}
          pageCount={1}
          isLoading={false}
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
