'use client'

import { useAssignSeatFromCheckout } from '@/hooks/queries'
import { validateEmail } from '@/utils/validation'
import { hasProductCheckout } from '@polar-sh/checkout/guards'
import type { CheckoutPublic } from '@polar-sh/sdk/models/components/checkoutpublic'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { MailCheckIcon, PlusIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Well, WellContent, WellHeader } from '../Shared/Well'

export interface CheckoutSeatInvitationsProps {
  checkout: CheckoutPublic
}

interface EmailInput {
  id: string
  value: string
  error?: string
  sent?: boolean
}

const CheckoutSeatInvitations = ({
  checkout,
}: CheckoutSeatInvitationsProps) => {
  const { seats, id: checkoutId } = checkout

  // Check if this is a seat-based product
  const isSeatBased =
    hasProductCheckout(checkout) &&
    checkout.productPrice.amountType === 'seat_based'

  const [emailInputs, setEmailInputs] = useState<EmailInput[]>(
    checkout.customerEmail
      ? [
          { id: '1', value: checkout.customerEmail },
          { id: '2', value: '' },
        ]
      : [{ id: '1', value: '' }],
  )
  const [isSending, setIsSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)

  const assignSeat = useAssignSeatFromCheckout(checkoutId)

  const availableSeats = (seats || 1) - sentCount
  const canAddMore = emailInputs.length < availableSeats

  const addEmailInput = () => {
    if (canAddMore) {
      setEmailInputs([...emailInputs, { id: Date.now().toString(), value: '' }])
    }
  }

  const removeEmailInput = (id: string) => {
    setEmailInputs(emailInputs.filter((input) => input.id !== id))
  }

  const updateEmailValue = (id: string, value: string) => {
    setEmailInputs(
      emailInputs.map((input) =>
        input.id === id ? { ...input, value, error: undefined } : input,
      ),
    )
  }

  const sendInvitations = async () => {
    // Validate all emails
    const validatedInputs = emailInputs.map((input) => {
      if (!input.value.trim()) {
        return { ...input, error: 'Email is required' }
      }
      if (!validateEmail(input.value)) {
        return { ...input, error: 'Invalid email format' }
      }
      return input
    })

    const hasErrors = validatedInputs.some((input) => input.error)
    if (hasErrors) {
      setEmailInputs(validatedInputs)
      return
    }

    setIsSending(true)

    // Send invitations sequentially
    for (const input of emailInputs) {
      if (input.sent) continue

      try {
        await assignSeat.mutateAsync({ email: input.value })
        setEmailInputs((prev) =>
          prev.map((i) => (i.id === input.id ? { ...i, sent: true } : i)),
        )
        setSentCount((prev) => prev + 1)
      } catch (error) {
        console.error('Failed to assign seat:', error)
        setEmailInputs((prev) =>
          prev.map((i) =>
            i.id === input.id
              ? { ...i, error: 'Failed to send invitation' }
              : i,
          ),
        )
      }
    }

    setIsSending(false)
  }

  const validEmails = emailInputs.filter(
    (input) => input.value.trim() && !input.error && !input.sent,
  ).length
  const canSend = validEmails > 0 && !isSending

  if (!isSeatBased || !seats) {
    return null
  }

  return (
    <Well className="dark:border-polar-700 dark:bg-polar-800 w-full border border-gray-200 bg-white">
      <WellHeader className="gap-y-4 text-left">
        {/* eslint-disable-next-line no-restricted-syntax */}
        <h2 className="text-xl">Invite team members</h2>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Invite team members to access your purchase.
        </p>
        <div className="flex items-center justify-between">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <p className="text-sm">
            {availableSeats} {availableSeats === 1 ? 'seat' : 'seats'} available
          </p>
        </div>
      </WellHeader>

      <WellContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {emailInputs.map((input) => (
            <div key={input.id} className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={input.value}
                  onChange={(e) => updateEmailValue(input.id, e.target.value)}
                  disabled={isSending || input.sent}
                  className={`${input.error ? 'border-red-500' : ''}`}
                />
                {input.error && (
                  <>
                    {/* eslint-disable-next-line no-restricted-syntax */}
                    <p className="mt-1 text-xs text-red-500">{input.error}</p>
                  </>
                )}
              </div>
              {input.sent ? (
                <div className="flex h-8 w-8 items-center justify-center">
                  <MailCheckIcon className="dark:text-polar-400 h-5 w-5 text-gray-700" />
                </div>
              ) : (
                emailInputs.length > 1 &&
                !input.sent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEmailInput(input.id)}
                    disabled={isSending}
                    className="dark:text-polar-500 dark:hover:text-polar-400 mt-0.5 text-gray-500 hover:text-gray-600"
                  >
                    <XIcon className="h-5 w-5" />
                  </Button>
                )
              )}
            </div>
          ))}

          {canAddMore && (
            <Button
              variant="secondary"
              size="sm"
              onClick={addEmailInput}
              disabled={isSending}
              className="self-start"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add another email
            </Button>
          )}
        </div>

        {availableSeats > 0 && (
          <Button
            onClick={sendInvitations}
            disabled={!canSend}
            loading={isSending}
            fullWidth
          >
            Send {validEmails > 0 ? `${validEmails} ` : ''}
            {validEmails === 1 ? 'Invitation' : 'Invitations'}
          </Button>
        )}

        {sentCount > 0 && (
          <>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <p className="dark:text-polar-500 mx-auto max-w-xs text-center text-xs text-pretty text-gray-500">
              Successfully assigned {sentCount}{' '}
              {sentCount === 1 ? 'seat' : 'seats'}.
              {availableSeats > 0 && (
                <>
                  {' '}
                  You can assign{' '}
                  {availableSeats === 1
                    ? 'one more seat'
                    : `${availableSeats} more seats`}
                  , or do that later through the Customer Portal.
                </>
              )}
            </p>
          </>
        )}
      </WellContent>
    </Well>
  )
}

export default CheckoutSeatInvitations
