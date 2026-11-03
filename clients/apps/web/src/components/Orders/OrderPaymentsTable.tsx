'use client'

import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import PaymentStatus from '@/components/PaymentStatus/PaymentStatus'
import { paymentDeclineReasonColumns } from '@/components/PaymentStatus/paymentDeclineReasonColumns'
import { schemas } from '@polar-sh/client'
import { DataTable } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { OrderSection } from './OrderSection'

export const OrderPaymentsTable = ({
  payments,
  isLoading,
}: {
  payments: schemas['Payment'][]
  isLoading: boolean
}) => {
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
          ...paymentDeclineReasonColumns(payments),
        ]}
        data={payments}
      />
    </OrderSection>
  )
}
