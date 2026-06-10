'use client'

import {
  useAssignSeat,
  useCustomerSeats,
  useResendSeatInvitation,
  useRevokeSeat,
} from '@/hooks/queries/customerPortal'
import { useTranslations } from '@/components/CustomerPortal/PortalLocaleProvider'
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
import { Input } from '@polar-sh/orbit'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { toast } from '../Toast/use-toast'
import { CustomerSeatQuantityManager } from './CustomerSeatQuantityManager'

const seatStatusToClassName = {
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  claimed:
    'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  revoked: 'bg-gray-100 text-gray-500 dark:bg-polar-700 dark:text-polar-500',
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
  seat_metadata?: Record<string, unknown> | null
}

type SeatBasedSubscription = { subscriptionId: string }
type SeatBasedOrder = { orderId: string }

interface SeatManagementTableProps {
  api: Client
  identifier: SeatBasedSubscription | SeatBasedOrder
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
  prorationBehavior,
}: SeatManagementTableProps) => {
  const t = useTranslations()
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
  const [isInviting, setIsInviting] = useState(false)
  const [loadingSeats, setLoadingSeats] = useState<Set<string>>(new Set())

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats: CustomerSeat[] = seatsData?.seats || []

  const handleAssignSeat = async () => {
    if (!email.trim()) {
      setError(t('portal.seats.emailRequired'))
      return
    }
    if (!validateEmail(email)) {
      setError(t('portal.seats.emailInvalid'))
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
            : t('portal.seats.assignError'),
        )
      } else {
        setEmail('')
        setIsInviting(false)
      }
    } catch {
      setError(t('portal.seats.invitationSendError'))
    } finally {
      setIsSending(false)
    }
  }

  const handleRevokeSeat = async (seatId: string) => {
    setLoadingSeats((prev) => new Set([...prev, seatId]))
    try {
      await revokeSeat.mutateAsync(seatId)
      toast({
        title: t('portal.seats.revokeSuccess.title'),
        description: t('portal.seats.revokeSuccess.description'),
      })
    } catch (error) {
      toast({
        title: t('portal.seats.revokeError.title'),
        description:
          error instanceof Error
            ? error.message
            : t('portal.seats.genericError'),
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
        title: t('portal.seats.resendSuccess.title'),
        description: t('portal.seats.resendSuccess.description'),
      })
    } catch (error) {
      toast({
        title: t('portal.seats.resendError.title'),
        description:
          error instanceof Error
            ? error.message
            : t('portal.seats.genericError'),
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

  const isSubscription = isSeatBasedSubscription(identifier)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg">{t('portal.seats.title')}</h3>
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
                  {t('portal.seats.columnEmail')}
                </th>
                <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium">
                  {t('portal.common.status')}
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
                  const label = t(`portal.seats.statusLabel.${seat.status}`)
                  const statusClassName = seatStatusToClassName[seat.status]
                  const isSeatLoading = loadingSeats.has(seat.id)

                  return (
                    <tr key={seat.id} className="border-b transition-colors">
                      <td className="p-4 align-middle">
                        <span className="text-sm">
                          {seat.customer_email || '—'}
                        </span>
                      </td>
                      <td className="p-4 align-middle">
                        <Status
                          className={twMerge(statusClassName, 'w-fit text-sm')}
                          status={label}
                        />
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
                                {seat.status === 'pending' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleResendInvitation(seat.id)
                                    }
                                    disabled={isSeatLoading}
                                  >
                                    {t('portal.seats.resendInvitation')}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleRevokeSeat(seat.id)}
                                  disabled={isSeatLoading}
                                >
                                  {t('portal.seats.revokeSeat')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              {availableSeats > 0 && (
                <tr className="border-b transition-colors">
                  <td colSpan={3} className="p-0">
                    {isInviting ? (
                      <div className="flex items-start gap-4 p-4">
                        <div className="flex-1">
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            value={email}
                            autoFocus
                            onChange={(e) => {
                              setEmail(e.target.value)
                              setError(undefined)
                            }}
                            disabled={isSending}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAssignSeat()
                              }
                              if (e.key === 'Escape') {
                                setIsInviting(false)
                                setEmail('')
                                setError(undefined)
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
                          disabled={!email.trim() || isSending}
                          loading={isSending}
                        >
                          {t('portal.seats.invite')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsInviting(false)
                            setEmail('')
                            setError(undefined)
                          }}
                        >
                          {t('portal.common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors"
                        onClick={() => setIsInviting(true)}
                      >
                        <span className="dark:text-polar-400 text-gray-500">
                          {t('portal.seats.availableSeats', {
                            count: availableSeats,
                          })}
                        </span>
                        <span className="dark:bg-polar-700 dark:hover:bg-polar-600 flex h-10 cursor-pointer items-center rounded-xl border border-black/4 bg-gray-100 px-3 text-sm font-medium text-black hover:bg-gray-200 dark:border-white/5 dark:text-white">
                          {t('portal.seats.inviteMember')}
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
