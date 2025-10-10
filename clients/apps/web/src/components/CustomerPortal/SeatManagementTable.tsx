'use client'

import {
  ArrowPathIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { useState } from 'react'

interface CustomerSeat {
  id: string
  subscription_id: string
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
      data={seats}
      isLoading={false}
      columns={[
        {
          accessorKey: 'customer_email',
          header: 'Email',
          cell: ({ row }) => (
            <span className="font-medium">
              {row.original.customer_email || 'N/A'}
            </span>
          ),
        },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => {
            const status = row.original.status
            const labels = {
              pending: 'Pending',
              claimed: 'Claimed',
              revoked: 'Revoked',
            }
            return (
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {labels[status]}
              </span>
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
                  <DropdownMenuTrigger disabled={isLoading}>
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {seat.status === 'pending' && (
                      <DropdownMenuItem
                        onClick={() => handleResend(seat.id)}
                        disabled={isLoading}
                      >
                        <ArrowPathIcon className="mr-2 h-4 w-4" />
                        Resend Invitation
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleRevoke(seat.id)}
                      disabled={isLoading}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
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
