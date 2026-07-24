'use client'

import { useDisputes } from '@/hooks/queries/disputes'
import {
  DisputeStatusDisplayColor,
  DisputeStatusDisplayTitle,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { DataTable, type DataTableColumnDef, Status } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Section } from '@/components/Shared/Section'

export const OrderDisputesTable = ({
  organization,
  order,
}: {
  organization: schemas['Organization']
  order: schemas['Order']
}) => {
  const { data: disputes, isLoading } = useDisputes(organization.id, {
    order_id: order.id,
  })

  if (!disputes || disputes.items.length === 0) {
    return null
  }

  return (
    <Section title="Disputes">
      <DataTable
        isLoading={isLoading}
        columns={
          [
            {
              accessorKey: 'created_at',
              header: 'Created At',
              cell: ({ row }) => (
                <FormattedDateTime
                  dateStyle="long"
                  datetime={row.original.created_at}
                />
              ),
            },
            {
              accessorKey: 'amount',
              header: 'Amount',
              cell: ({ row }) =>
                formatCurrency('standard')(
                  row.original.amount,
                  row.original.currency,
                ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => (
                <Status
                  color={DisputeStatusDisplayColor[row.original.status]}
                  status={DisputeStatusDisplayTitle[row.original.status]}
                />
              ),
            },
          ] satisfies DataTableColumnDef<schemas['Dispute']>[]
        }
        data={disputes.items}
      />
    </Section>
  )
}
