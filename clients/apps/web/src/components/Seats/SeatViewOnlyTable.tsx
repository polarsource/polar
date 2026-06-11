'use client'

import { DataTable, type StatusColor } from '@polar-sh/orbit'
import { Status } from '@polar-sh/orbit'

const seatStatusToDisplayName: Record<
  'pending' | 'claimed' | 'revoked',
  [string, StatusColor]
> = {
  pending: ['Pending', 'yellow'],
  claimed: ['Claimed', 'green'],
  revoked: ['Revoked', 'gray'],
}

interface CustomerSeat {
  id: string
  subscription_id?: string | null
  order_id?: string | null
  status: 'pending' | 'claimed' | 'revoked'
  customer_id?: string | null
  customer_email?: string | null
  claimed_at?: string | null
  revoked_at?: string | null
  created_at: string
  seat_metadata?: Record<string, unknown> | null
}

interface SeatViewOnlyTableProps {
  seats: CustomerSeat[]
}

export const SeatViewOnlyTable = ({ seats }: SeatViewOnlyTableProps) => {
  return (
    <DataTable
      data={seats.sort((a, b) => {
        const order = ['claimed', 'pending', 'revoked']
        return order.indexOf(a.status) - order.indexOf(b.status)
      })}
      isLoading={false}
      columns={[
        {
          accessorKey: 'customer_email',
          header: 'Email',
          cell: ({ row }) => (
            <span className="text-sm">
              {row.original.customer_email || '—'}
            </span>
          ),
        },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => {
            const status = row.original.status
            const [label, color] = seatStatusToDisplayName[status]
            return <Status color={color} status={label} size="small" />
          },
        },
      ]}
    />
  )
}
