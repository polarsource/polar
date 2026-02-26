'use client'

import {
  useAssignSeat,
  useCustomerSeats,
  useResendSeatInvitation,
  useRevokeSeat,
} from '@/hooks/queries'
import { validateEmail } from '@/utils/validation'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Client } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { toast } from '../Toast/use-toast'

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

type SeatBasedSubscription = { subscriptionId: string }
type SeatBasedOrder = { orderId: string }

interface SeatManagementTableProps {
  api: Client
  identifier: SeatBasedSubscription | SeatBasedOrder
}

function isSeatBasedSubscription(
  identifier: SeatBasedSubscription | SeatBasedOrder,
): identifier is SeatBasedSubscription {
  return (identifier as SeatBasedSubscription).subscriptionId !== undefined
}

export const SeatManagementTable = ({
  api,
  identifier,
}: SeatManagementTableProps) => {
  const { data: seatsData, isLoading: isLoadingSeats } = useCustomerSeats(
    api,
    isSeatBasedSubscription(identifier)
      ? { subscriptionId: identifier.subscriptionId }
      : { orderId: identifier.orderId },
  )
  const assignSeat = useAssignSeat(api)
  const revokeSeat = useRevokeSeat(api)
  const resendInvitation = useResendSeatInvitation(api)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [isSending, setIsSending] = useState(false)
  const [loadingSeats, setLoadingSeats] = useState<Set<string>>(new Set())

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats: CustomerSeat[] = seatsData?.seats || []

  const handleAssignSeat = async () => {
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!validateEmail(email)) {
      setError('Invalid email format')
      return
    }

    setIsSending(true)
    setError(undefined)

    try {
      const body =
        'subscriptionId' in identifier
          ? { subscription_id: identifier.subscriptionId, email }
          : { order_id: identifier.orderId, email }

      const result = await assignSeat.mutateAsync(body)

      if (result.error) {
        setError(
          typeof result.error.detail === 'string'
            ? result.error.detail
            : 'Failed to assign seat',
        )
      } else {
        setEmail('')
      }
    } catch {
      setError('Failed to send invitation')
    } finally {
      setIsSending(false)
    }
  }

  const handleRevokeSeat = async (seatId: string) => {
    setLoadingSeats((prev) => new Set([...prev, seatId]))
    try {
      await revokeSeat.mutateAsync(seatId)
      toast({
        title: 'Seat revoked successfully',
        description: 'The seat has been revoked and is now available.',
      })
    } catch (error) {
      toast({
        title: 'Failed to revoke seat',
        description:
          error instanceof Error ? error.message : 'An error occurred.',
        variant: 'error',
      })
    } finally {
      setLoadingSeats((prev) => {
        const next = new Set(prev)
        next.delete(seatId)
        return next
      })
    }
  }

  const handleResendInvitation = async (seatId: string) => {
    setLoadingSeats((prev) => new Set([...prev, seatId]))
    try {
      await resendInvitation.mutateAsync(seatId)
      toast({
        title: 'Invitation resent',
        description: 'The invitation email has been sent again.',
      })
    } catch (error) {
      toast({
        title: 'Failed to resend invitation',
        description:
          error instanceof Error ? error.message : 'An error occurred.',
        variant: 'error',
      })
    } finally {
      setLoadingSeats((prev) => {
        const next = new Set(prev)
        next.delete(seatId)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg">Invite Members</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          {availableSeats} of {totalSeats} seats available
        </p>
      </div>
      <div className="flex flex-col gap-y-3">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(undefined)
              }}
              disabled={isSending || availableSeats === 0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAssignSeat()
                }
              }}
            />
            {error && (
              <p className="dark:text-polar-400 mt-1 text-xs text-gray-500">
                {error}
              </p>
            )}
          </div>
          <Button
            onClick={handleAssignSeat}
            disabled={!email.trim() || availableSeats === 0 || isSending}
            loading={isSending}
          >
            Invite
          </Button>
        </div>
      </div>

      {!isLoadingSeats && seats.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Assigned Seats</h3>
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
                              onClick={() => handleResendInvitation(seat.id)}
                              disabled={isLoading}
                            >
                              Resend Invitation
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleRevokeSeat(seat.id)}
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
        </div>
      )}
    </div>
  )
}
