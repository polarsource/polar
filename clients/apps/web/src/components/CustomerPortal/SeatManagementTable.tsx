'use client'

import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useState } from 'react'
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

interface SeatManagementTableProps {
  seats: CustomerSeat[]
  onRevokeSeat: (seatId: string) => Promise<void>
  onResendInvitation: (seatId: string) => Promise<void>
}

export const SeatManagementTable = ({
  seats,
  onRevokeSeat,
  onResendInvitation,
}: SeatManagementTableProps) => {
  const [loadingSeats, setLoadingSeats] = useState<Set<string>>(new Set())

  const handleRevoke = async (seatId: string) => {
    setLoadingSeats((prev) => new Set([...prev, seatId]))
    try {
      await onRevokeSeat(seatId)
    } finally {
      setLoadingSeats((prev) => {
        const next = new Set(prev)
        next.delete(seatId)
        return next
      })
    }
  }

  const handleResend = async (seatId: string) => {
    setLoadingSeats((prev) => new Set([...prev, seatId]))
    try {
      await onResendInvitation(seatId)
    } finally {
      setLoadingSeats((prev) => {
        const next = new Set(prev)
        next.delete(seatId)
        return next
      })
    }
  }

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
        {
          id: 'actions',
          header: '',
          cell: ({ row }) => {
            const seat = row.original
            const isLoading = loadingSeats.has(seat.id)

            if (seat.status === 'revoked') {
              return null
            }

            return (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isLoading}>
                    <Button className="h-8 w-8" variant="secondary">
                      <MoreVertOutlined fontSize="inherit" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {seat.status === 'pending' && (
                      <DropdownMenuItem
                        onClick={() => handleResend(seat.id)}
                        disabled={isLoading}
                      >
                        Resend Invitation
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleRevoke(seat.id)}
                      disabled={isLoading}
                    >
                      Revoke Seat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        },
      ]}
    />
  )
}
