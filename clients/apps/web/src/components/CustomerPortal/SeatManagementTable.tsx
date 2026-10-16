'use client'

import {
  useAssignSeat,
  useCustomerSeats,
  useResendSeatInvitation,
  useRevokeSeat,
  useUpdateCustomerPortalMember,
} from '@/hooks/queries/customerPortal'
import { useCopyMemberLoginLink } from '@/hooks/useCopyMemberLoginLink'
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
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { toast } from '../Toast/use-toast'
import { seatStatusDisplayConfig } from '../Seats/seatStatus'
import { CustomerSeatQuantityManager } from './CustomerSeatQuantityManager'
import { InlineEditRow } from './InlineEditRow'
import {
  PortalCardList,
  PortalListItem,
  PortalSection,
  PortalText,
} from './PortalPrimitives'

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
  const copyMemberLoginLink = useCopyMemberLoginLink(organizationSlug)

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
    <PortalSection
      title="Seats"
      description={
        !isLoadingSeats
          ? `${totalSeats - availableSeats} of ${totalSeats} seats assigned`
          : undefined
      }
    >
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
        <PortalCardList>
          {seats
            .sort((a, b) => {
              const order = ['claimed', 'pending', 'revoked']
              return order.indexOf(a.status) - order.indexOf(b.status)
            })
            .map((seat) => {
              const [label, color] = seatStatusDisplayConfig[seat.status]
              const isSeatLoading = loadingSeats.has(seat.id)
              const memberName = seat.member?.name
              const memberEmail =
                seat.member?.email || seat.customer_email || '—'

              if (editingSeatId === seat.id) {
                return (
                  <InlineEditRow
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
                <PortalListItem
                  key={seat.id}
                  title={memberName ?? memberEmail}
                  subtitle={memberName ? memberEmail : undefined}
                  meta={<Status size="small" color={color} status={label} />}
                  actions={
                    seat.status !== 'revoked' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={isSeatLoading}>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Seat actions"
                          >
                            <MoreVertOutlined fontSize="inherit" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {seat.status === 'claimed' && memberEmail !== '—' && (
                            <DropdownMenuItem
                              onClick={() => copyMemberLoginLink(memberEmail)}
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
                              onClick={() => handleResendInvitation(seat.id)}
                              disabled={isSeatLoading}
                            >
                              Resend invitation
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleRevokeSeat(seat.id)}
                            disabled={isSeatLoading}
                          >
                            Revoke seat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                />
              )
            })}
          {availableSeats > 0 &&
            (isInviting ? (
              <InlineEditRow
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
              <Box
                as="li"
                display="flex"
                alignItems="center"
                justifyContent="between"
                columnGap="l"
                paddingHorizontal={{ base: 'l', md: 'xl' }}
                paddingVertical="m"
                borderRadius="l"
                borderWidth={1}
                borderStyle="dashed"
                borderColor="border-primary"
              >
                <PortalText tone="secondary" className="text-sm">
                  {availableSeats === 1
                    ? 'One more seat available'
                    : `${availableSeats} more seats available`}
                </PortalText>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsInviting(true)}
                >
                  Invite member
                </Button>
              </Box>
            ))}
        </PortalCardList>
      )}
    </PortalSection>
  )
}
