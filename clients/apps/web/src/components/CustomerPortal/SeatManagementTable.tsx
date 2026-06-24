'use client'

import {
  useAssignSeat,
  useCustomerSeats,
  useResendSeatInvitation,
  useRevokeSeat,
  useUpdateCustomerPortalMember,
} from '@/hooks/queries/customerPortal'
import { useSafeCopy } from '@/hooks/clipboard'
import { CONFIG } from '@/utils/config'
import { validateEmail } from '@/utils/validation'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { Status } from '@polar-sh/orbit'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { toast } from '../Toast/use-toast'
import { seatStatusDisplayConfig } from '../Seats/seatStatus'
import { CustomerSeatQuantityManager } from './CustomerSeatQuantityManager'
import { InlineEditTableRow } from './InlineEditTableRow'

type CustomerSeat = schemas['CustomerSeat']

type SeatBasedSubscription = { subscriptionId: string }
type SeatBasedOrder = { orderId: string }

interface SeatManagementTableProps {
  api: Client
  identifier: SeatBasedSubscription | SeatBasedOrder
  organizationSlug: string
  prorationBehavior?: schemas['CustomerOrganization']['proration_behavior']
}

function isSeatBasedSubscription(
  identifier: SeatBasedSubscription | SeatBasedOrder,
): identifier is SeatBasedSubscription {
  return (identifier as SeatBasedSubscription).subscriptionId !== undefined
}

export const SeatManagementTable = ({
  api,
  identifier,
  organizationSlug,
  prorationBehavior,
}: SeatManagementTableProps) => {
  const safeCopy = useSafeCopy(toast)

  const { data: seatsData, isLoading: isLoadingSeats } = useCustomerSeats(
    api,
    isSeatBasedSubscription(identifier)
      ? { subscriptionId: identifier.subscriptionId }
      : { orderId: identifier.orderId },
  )
  const assignSeat = useAssignSeat(api)
  const revokeSeat = useRevokeSeat(api)
  const resendInvitation = useResendSeatInvitation(api)
  const updateMember = useUpdateCustomerPortalMember(api)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [isInviting, setIsInviting] = useState(false)
  const [loadingSeats, setLoadingSeats] = useState<Set<string>>(new Set())
  const [editingSeatId, setEditingSeatId] = useState<string>()
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string>()

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
        setIsInviting(false)
      }
    } catch {
      setError('Failed to send invitation')
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

  const handleCopyLoginLink = async (memberEmail: string) => {
    const link = `${CONFIG.FRONTEND_BASE_URL}/${organizationSlug}/portal/request?email=${encodeURIComponent(
      memberEmail,
    )}`
    await safeCopy(link)
    toast({
      title: 'Login link copied',
      description:
        'Share it with the member so they can sign in to the portal with their email.',
    })
  }

  const startEditingName = (seat: CustomerSeat) => {
    setEditingSeatId(seat.id)
    setEditName(seat.member?.name ?? '')
    setEditError(undefined)
  }

  const cancelEditingName = () => {
    setEditingSeatId(undefined)
    setEditName('')
    setEditError(undefined)
  }

  const handleSaveName = async (seat: CustomerSeat) => {
    if (!seat.member?.id) {
      return
    }

    setEditError(undefined)
    try {
      await updateMember.mutateAsync({
        id: seat.member.id,
        body: { name: editName.trim() || null },
      })
      cancelEditingName()
      toast({
        title: 'Name updated',
        description: "The member's name has been updated.",
      })
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : 'Failed to update name',
      )
    }
  }

  const isSubscription = isSeatBasedSubscription(identifier)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg">Seat Management</h3>
      </div>

      {isSubscription && !isLoadingSeats && (
        <CustomerSeatQuantityManager
          api={api}
          subscriptionId={identifier.subscriptionId}
          totalSeats={totalSeats}
          availableSeats={availableSeats}
          prorationBehavior={prorationBehavior}
        />
      )}

      {!isLoadingSeats && (seats.length > 0 || availableSeats > 0) && (
        <div className="dark:border-polar-700 overflow-hidden rounded-2xl border border-gray-200">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="dark:bg-polar-800 border-b bg-gray-50">
                <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium">
                  Member
                </th>
                <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium">
                  Status
                </th>
                <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium" />
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {seats
                .sort((a, b) => {
                  const order = ['claimed', 'pending', 'revoked']
                  return order.indexOf(a.status) - order.indexOf(b.status)
                })
                .map((seat) => {
                  const [label, color] = seatStatusDisplayConfig[seat.status]
                  const isSeatLoading = loadingSeats.has(seat.id)

                  const isEditingName = editingSeatId === seat.id
                  const memberName = seat.member?.name
                  const memberEmail =
                    seat.member?.email || seat.customer_email || '—'

                  if (isEditingName) {
                    return (
                      <InlineEditTableRow
                        key={seat.id}
                        value={editName}
                        placeholder="Member name"
                        loading={updateMember.isPending}
                        error={editError}
                        onChange={(value) => {
                          setEditName(value)
                          setEditError(undefined)
                        }}
                        onSave={() => handleSaveName(seat)}
                        onCancel={cancelEditingName}
                      />
                    )
                  }

                  return (
                    <tr key={seat.id} className="border-b transition-colors">
                      <td className="p-4 align-middle">
                        <Box flexDirection="column">
                          {memberName && <Text>{memberName}</Text>}
                          <Text color={memberName ? 'muted' : undefined}>
                            {memberEmail}
                          </Text>
                        </Box>
                      </td>
                      <td className="p-4 align-middle">
                        <Status color={color} status={label} />
                      </td>
                      <td className="p-4 align-middle">
                        {seat.status !== 'revoked' && (
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                asChild
                                disabled={isSeatLoading}
                              >
                                <Button variant="ghost" size="icon">
                                  <MoreVertOutlined fontSize="inherit" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {seat.status === 'claimed' &&
                                  memberEmail !== '—' && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleCopyLoginLink(memberEmail)
                                      }
                                      disabled={isSeatLoading}
                                    >
                                      Copy login link
                                    </DropdownMenuItem>
                                  )}
                                {seat.member?.id && (
                                  <DropdownMenuItem
                                    onClick={() => startEditingName(seat)}
                                    disabled={isSeatLoading}
                                  >
                                    Edit name
                                  </DropdownMenuItem>
                                )}
                                {seat.status === 'pending' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleResendInvitation(seat.id)
                                    }
                                    disabled={isSeatLoading}
                                  >
                                    Resend Invitation
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleRevokeSeat(seat.id)}
                                  disabled={isSeatLoading}
                                >
                                  Revoke Seat
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              {availableSeats > 0 &&
                (isInviting ? (
                  <InlineEditTableRow
                    type="email"
                    value={email}
                    placeholder="email@example.com"
                    submitLabel="Invite"
                    loading={assignSeat.isPending}
                    error={error}
                    onChange={(value) => {
                      setEmail(value)
                      setError(undefined)
                    }}
                    onSave={handleAssignSeat}
                    onCancel={() => {
                      setIsInviting(false)
                      setEmail('')
                      setError(undefined)
                    }}
                  />
                ) : (
                  <tr className="border-b transition-colors">
                    <td colSpan={3} className="p-0">
                      <Box alignItems="center" justifyContent="between" p="l">
                        <Text color="muted">
                          {availableSeats === 1
                            ? 'One more seat available'
                            : `${availableSeats} more seats available`}
                        </Text>
                        <Button
                          variant="secondary"
                          onClick={() => setIsInviting(true)}
                        >
                          Invite member
                        </Button>
                      </Box>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
