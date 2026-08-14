'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import {
  useResendOrganizationSeatInvitation,
  useRevokeOrganizationSeat,
} from '@/hooks/queries/seats'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import {
  Button,
  DataTable,
  type DataTableColumnDef,
  Status,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { useState } from 'react'
import { toast } from '../Toast/use-toast'
import { seatStatusDisplayConfig } from './seatStatus'

export const OrganizationSeatTable = ({
  seats,
}: {
  seats: schemas['CustomerSeat'][]
}) => {
  const revokeSeat = useRevokeOrganizationSeat()
  const resendInvitation = useResendOrganizationSeatInvitation()
  const [loadingSeats, setLoadingSeats] = useState<Set<string>>(new Set())
  const [seatToRevoke, setSeatToRevoke] = useState<
    schemas['CustomerSeat'] | undefined
  >()

  const setSeatLoading = (seatId: string, loading: boolean) => {
    setLoadingSeats((prev) => {
      const next = new Set(prev)
      if (loading) {
        next.add(seatId)
      } else {
        next.delete(seatId)
      }
      return next
    })
  }

  const handleRevokeSeat = async (seat: schemas['CustomerSeat']) => {
    setSeatLoading(seat.id, true)
    try {
      await revokeSeat.mutateAsync(seat.id)
      toast({
        title: 'Seat revoked',
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
      setSeatLoading(seat.id, false)
    }
  }

  const handleResendInvitation = async (seat: schemas['CustomerSeat']) => {
    setSeatLoading(seat.id, true)
    try {
      await resendInvitation.mutateAsync(seat.id)
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
      setSeatLoading(seat.id, false)
    }
  }

  return (
    <>
      <DataTable
        data={[...seats].sort((a, b) => {
          const order = ['claimed', 'pending', 'revoked']
          return order.indexOf(a.status) - order.indexOf(b.status)
        })}
        isLoading={false}
        columns={
          [
            {
              accessorKey: 'customer_email',
              header: 'Email',
              cell: ({ row }) => row.original.customer_email || '—',
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row }) => {
                const [label, color] =
                  seatStatusDisplayConfig[row.original.status]
                return <Status color={color} status={label} />
              },
            },
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => {
                const seat = row.original
                if (seat.status === 'revoked') {
                  return null
                }
                const isSeatLoading = loadingSeats.has(seat.id)
                return (
                  <Box justifyContent="end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild disabled={isSeatLoading}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for seat ${seat.customer_email ?? seat.id}`}
                        >
                          <MoreVertOutlined fontSize="inherit" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {seat.status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => handleResendInvitation(seat)}
                            disabled={isSeatLoading}
                          >
                            Resend Invitation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setSeatToRevoke(seat)}
                          disabled={isSeatLoading}
                        >
                          Revoke Seat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Box>
                )
              },
            },
          ] satisfies DataTableColumnDef<schemas['CustomerSeat']>[]
        }
      />
      <ConfirmModal
        isShown={seatToRevoke !== undefined}
        hide={() => setSeatToRevoke(undefined)}
        title="Revoke Seat"
        description={`The seat${seatToRevoke?.customer_email ? ` for ${seatToRevoke.customer_email}` : ''} will be revoked and its benefits removed. The seat becomes available for reassignment.`}
        destructive
        destructiveText="Revoke Seat"
        onConfirm={() => {
          if (seatToRevoke) {
            handleRevokeSeat(seatToRevoke)
          }
        }}
      />
    </>
  )
}
