'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useOrganizationEmail,
  useSendOrganizationEmailCode,
  useVerifyOrganizationEmail,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const RESEND_DELAY_MS = 15_000

interface Props {
  organization: schemas['Organization']
  codeJustSent?: boolean
  updateEmailHref?: string
  onVerified?: () => void
}

export const SupportEmailVerifyFlow = ({
  organization,
  codeJustSent = false,
  updateEmailHref,
  onVerified,
}: Props) => {
  const { data: status } = useOrganizationEmail(organization.id)
  const sendCode = useSendOrganizationEmailCode(organization.id)
  const verify = useVerifyOrganizationEmail(organization.id)
  const [step, setStep] = useState<'send' | 'code' | null>(
    codeJustSent ? 'code' : null,
  )
  const [canResend, setCanResend] = useState(!codeJustSent)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!codeJustSent) return
    const timeout = setTimeout(() => setCanResend(true), RESEND_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [codeJustSent])

  if (!status?.email) return null
  const email = status.email
  const currentStep = step ?? (status.code_pending ? 'code' : 'send')

  const onSend = async () => {
    setError(null)
    const { error } = await sendCode.mutateAsync()
    if (error) {
      toast({
        title: 'Failed to send the code',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
      return
    }
    setCode('')
    setStep('code')
    setCanResend(false)
    setTimeout(() => setCanResend(true), RESEND_DELAY_MS)
  }

  const onVerify = async (value: string) => {
    setError(null)
    const { error } = await verify.mutateAsync({ code: value })
    if (error) {
      setError(
        extractApiErrorMessage(error, 'This code is invalid or has expired.'),
      )
      return
    }
    toast({
      title: 'Support email verified',
      description: `${email} is verified.`,
    })
    onVerified?.()
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Box color="text-secondary">
        <p className="text-sm">
          When customers reply to their receipts, invoices or subscription
          emails, their replies go to this address, so make sure it&apos;s
          monitored.
        </p>
      </Box>
      {currentStep === 'send' ? (
        <>
          <Box columnGap="s">
            <Input value={email} disabled aria-label="Support email" />
            <Button type="button" loading={sendCode.isPending} onClick={onSend}>
              Verify
            </Button>
          </Box>
          {updateEmailHref && (
            <Box color="text-secondary">
              <p className="text-xs">
                Wrong email?{' '}
                <Link
                  href={updateEmailHref}
                  className="underline underline-offset-2"
                >
                  Update your support email
                </Link>
              </p>
            </Box>
          )}
        </>
      ) : (
        <>
          <Box color="text-secondary">
            <p className="text-sm">
              Enter the code we sent to{' '}
              <Box as="span" color="text-primary">
                {email}
              </Box>
              . It is valid for 30 minutes.
            </p>
          </Box>
          <InputOTP
            containerClassName="w-full"
            maxLength={6}
            pattern="^[a-zA-Z0-9]+$"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            disabled={verify.isPending}
            value={code}
            onChange={(value) => setCode(value.toUpperCase())}
            onComplete={(value: string) => onVerify(value.toUpperCase())}
          >
            <InputOTPGroup className="w-full">
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-12 flex-1 text-xl"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && (
            <Box color="text-danger">
              <p className="text-xs">{error}</p>
            </Box>
          )}
          {canResend && (
            <Box justifyContent="center" color="text-secondary">
              <p className="text-xs">
                I didn&apos;t receive my code.{' '}
                <button
                  type="button"
                  className="cursor-pointer underline underline-offset-2 disabled:cursor-default disabled:opacity-60"
                  disabled={sendCode.isPending}
                  onClick={onSend}
                >
                  Resend
                </button>
              </p>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
