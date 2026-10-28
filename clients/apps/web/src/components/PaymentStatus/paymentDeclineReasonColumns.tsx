import { getPaymentDeclineMessage } from '@/utils/payment'
import { schemas } from '@polar-sh/client'
import { type DataTableColumnDef, Text, Truncated } from '@polar-sh/orbit'

export const paymentDeclineReasonColumns = (
  payments: schemas['Payment'][],
): DataTableColumnDef<schemas['Payment']>[] =>
  payments.some((payment) => payment.status === 'failed')
    ? [
        {
          accessorKey: 'decline_reason',
          header: 'Decline Reason',
          cell: ({ row: { original } }) => {
            const reason = getPaymentDeclineMessage(original)
            return reason ? (
              <Truncated>
                <Text as="span">{reason}</Text>
              </Truncated>
            ) : (
              '—'
            )
          },
        },
      ]
    : []
