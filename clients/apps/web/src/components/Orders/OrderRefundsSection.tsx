'use client'

import { useModal } from '@/components/Modal/useModal'
import { RefundModal } from '@/components/Refunds/RefundModal'
import {
  RefundReasonDisplay,
  RefundStatusDisplayColor,
  RefundStatusDisplayTitle,
} from '@/components/Refunds/utils'
import { useRefunds } from '@/hooks/queries/refunds'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import {
  Button,
  DataTable,
  type DataTableColumnDef,
  InlineModal,
  Status,
} from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Section } from '@/components/Shared/Section'

export const OrderRefundsSection = ({ order }: { order: schemas['Order'] }) => {
  const { data: refunds, isLoading } = useRefunds(order.id)
  const {
    isShown: isRefundModalShown,
    show: showRefundModal,
    hide: hideRefundModal,
  } = useModal()

  if (!order.paid) {
    return null
  }

  const canRefund = (order.refunded_amount ?? 0) < (order.net_amount ?? 0)

  return (
    <Section
      title="Refunds"
      action={
        canRefund ? (
          <Button onClick={showRefundModal}>Refund order</Button>
        ) : undefined
      }
    >
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
                  color={RefundStatusDisplayColor[row.original.status]}
                  status={RefundStatusDisplayTitle[row.original.status]}
                />
              ),
            },
            {
              accessorKey: 'reason',
              header: 'Reason',
              cell: ({ row }) => RefundReasonDisplay[row.original.reason],
            },
            {
              accessorKey: 'revoke_benefits',
              header: 'Revoke Benefits',
              cell: ({ row }) => (
                <Status
                  status={row.original.revoke_benefits ? 'True' : 'False'}
                  color={row.original.revoke_benefits ? 'green' : 'red'}
                />
              ),
            },
          ] satisfies DataTableColumnDef<schemas['Refund']>[]
        }
        data={refunds?.items ?? []}
      />

      <InlineModal
        isShown={isRefundModalShown}
        hide={hideRefundModal}
        modalContent={<RefundModal order={order} hide={hideRefundModal} />}
      />
    </Section>
  )
}
