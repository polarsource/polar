'use client'

import { EmptyState } from '@/components/CustomerPortal/EmptyState'
import { SeatManagementTable } from '@/components/CustomerPortal/SeatManagementTable'
import { Well, WellContent, WellHeader } from '@/components/Shared/Well'
import { toast } from '@/components/Toast/use-toast'
import {
  useAssignSeat,
  useCustomerSeats,
  useResendSeatInvitation,
  useRevokeSeat,
} from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import { validateEmail } from '@/utils/validation'
import { PlusIcon } from '@heroicons/react/24/outline'
import ChairOutlined from '@mui/icons-material/ChairOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useState } from 'react'

interface ClientPageProps {
  subscriptions: schemas['CustomerSubscription'][]
  customerSessionToken: string
}

const ClientPage = ({
  subscriptions,
  customerSessionToken,
}: ClientPageProps) => {
  const api = createClientSideAPI(customerSessionToken)
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(
    subscriptions[0]?.id,
  )

  const selectedSubscription = subscriptions.find(
    (s) => s.id === selectedSubscriptionId,
  )

  const { data: seatsData, isLoading } = useCustomerSeats(
    api,
    selectedSubscriptionId,
  )
  const assignSeat = useAssignSeat(api)
  const revokeSeat = useRevokeSeat(api)
  const resendInvitation = useResendSeatInvitation(api)

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [isSending, setIsSending] = useState(false)

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
      const result = await assignSeat.mutateAsync({
        subscription_id: selectedSubscriptionId!,
        email,
      })

      if (result.error) {
        const errorMessage =
          typeof result.error.detail === 'string'
            ? result.error.detail
            : 'Failed to assign seat'
        setError(errorMessage)
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
    }
  }

  const handleResendInvitation = async (seatId: string) => {
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
    }
  }

  if (subscriptions.length === 0) {
    return (
      <EmptyState
        icon={<ChairOutlined />}
        title="No Seat Subscriptions"
        description="You don't manage any seat-based subscriptions at the moment."
      />
    )
  }

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats = seatsData?.seats || []

  return (
    <div className="flex flex-col gap-y-6">
      <h3 className="text-2xl">Seats</h3>

      <Tabs className="flex flex-col gap-6" value={selectedSubscriptionId}>
        {subscriptions.length > 1 && (
          <TabsList className="dark:bg-polar-900 flex flex-wrap gap-2 rounded-xl bg-gray-50">
            {subscriptions.map((sub) => (
              <TabsTrigger
                className="dark:data-[state=active]:bg-polar-700 data-[state=active]:rounded-lg data-[state=active]:bg-white"
                key={sub.id}
                value={sub.id}
                onClick={() => setSelectedSubscriptionId(sub.id)}
              >
                {sub.product.name}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {subscriptions.map((sub) => (
          <TabsContent
            key={sub.id}
            value={sub.id}
            className="flex flex-col gap-6"
          >
            <Well className="dark:border-polar-700 flex flex-col gap-y-6 border border-gray-200 bg-transparent dark:bg-transparent">
              <WellHeader>
                <div className="flex flex-col gap-y-2">
                  <h3 className="text-xl">
                    {subscriptions.length > 1
                      ? selectedSubscription?.product.name
                      : 'Manage Seats'}
                  </h3>
                  <p className="dark:text-polar-500 text-sm text-gray-500">
                    {availableSeats} of {totalSeats} seats available
                  </p>
                </div>
              </WellHeader>
              <Separator className="dark:bg-polar-700" />
              <WellContent className="gap-y-4">
                <div className="flex flex-col gap-y-3">
                  <div className="flex items-start gap-2">
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
                      disabled={
                        !email.trim() || availableSeats === 0 || isSending
                      }
                      loading={isSending}
                    >
                      <PlusIcon className="mr-2 h-4 w-4" />
                      Invite
                    </Button>
                  </div>
                </div>
              </WellContent>
            </Well>

            {!isLoading && seats.length > 0 && (
              <div className="flex flex-col gap-6">
                <h3 className="text-xl">Manage Seats</h3>
                <SeatManagementTable
                  seats={seats}
                  onRevokeSeat={handleRevokeSeat}
                  onResendInvitation={handleResendInvitation}
                />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default ClientPage
