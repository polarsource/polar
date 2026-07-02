'use client'

import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { schemas } from '@polar-sh/client'
import {
  DataTable,
  type DataTableColumnDef,
  Text,
  Truncated,
} from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { OrderSection } from './OrderSection'

export const OrderPaymentsTable = ({
  payments,
  isLoading,
}: {
  payments: schemas['Payment'][]
  isLoading: boolean
}) => {
  const hasDeclinedPayment = payments.some(
    (payment) => payment.status === 'failed',
  )

  return (
    <OrderSection title="Payment attempts">
      <DataTable
        isLoading={isLoading}
        columns={[
          {
            accessorKey: 'created_at',
            header: 'Created At',
            cell: ({
              row: {
                original: { created_at },
              },
            }) => (
              <FormattedDateTime
                dateStyle="medium"
                resolution="time"
                datetime={created_at}
              />
            ),
          },
          {
            accessorKey: 'method',
            header: 'Method',
            cell: ({ row: { original } }) => (
              <PaymentMethod payment={original} />
            ),
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row: { original } }) => (
              <PaymentStatus payment={original} />
            ),
          },
          ...(hasDeclinedPayment
            ? ([
                {
                  accessorKey: 'decline_reason',
                  header: 'Bank Decline Reason',
                  cell: ({ row: { original } }) => {
                    const reason =
                      original.decline_message || original.decline_reason
                    return reason ? (
                      <Truncated>
                        <Text as="span">{reason}</Text>
                      </Truncated>
                    ) : (
                      '—'
                    )
                  },
                },
              ] satisfies DataTableColumnDef<schemas['Payment']>[])
            : []),
        ]}
        data={payments}
      />
    </OrderSection>
  )
}
