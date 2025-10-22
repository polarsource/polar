'use client'

import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'

const seatStatusToDisplayName = {
  pending: [
    'Pending',
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  ],
  claimed: [
    'Claimed',
    'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  ],
  revoked: [
    'Revoked',
    'bg-gray-100 text-gray-500 dark:bg-polar-700 dark:text-polar-500',
  ],
} as const

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
  seat_metadata?: Record<string, any> | null
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
            const [label, className] = seatStatusToDisplayName[status]
            return (
              <Status
                className={twMerge(className, 'w-fit text-xs')}
                status={label}
              />
            )
          },
        },
      ]}
    />
  )
}
