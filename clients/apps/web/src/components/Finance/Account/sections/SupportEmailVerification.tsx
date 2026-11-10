'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  useOrganizationEmail,
  useSendOrganizationEmailCode,
  useVerifyOrganizationEmail,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Button, Input, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'

const RESEND_COOLDOWN_MS = 30_000

interface Props {
  organization: schemas['Organization']
}

export const SupportEmailVerification = ({ organization }: Props) => {
  const { data: status } = useOrganizationEmail(organization.id)
  const sendCode = useSendOrganizationEmailCode(organization.id)
  const verify = useVerifyOrganizationEmail(organization.id)
  const [code, setCode] = useState('')
  const [resendLocked, setResendLocked] = useState(false)

  if (!status?.email) return null

  const onSend = async () => {
    const { error } = await sendCode.mutateAsync()
    if (error) {
      toast({
        title: 'Failed to send the code',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
      return
    }
    setResendLocked(true)
    setTimeout(() => setResendLocked(false), RESEND_COOLDOWN_MS)
  }

  const onVerify = async () => {
    const { error } = await verify.mutateAsync({ code })
    if (error) {
      toast({
        title: 'Code not accepted',
        description: extractApiErrorMessage(error, 'Please try again.'),
      })
      return
    }
    setCode('')
  }

  return (
    <Box
      flexDirection="column"
      rowGap="m"
      marginTop="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingTop="m"
    >
      <Box alignItems="center" columnGap="s">
        <Text variant="label">Verify your support email</Text>
        {status.verified ? (
          <Pill color="green">Verified</Pill>
        ) : (
          <Pill color="red">Required</Pill>
        )}
      </Box>
      {status.verified ? (
        <Text color="muted">
          {status.email} is verified. Changing it will ask for a new code.
        </Text>
      ) : status.code_pending ? (
        <>
          <Text color="muted">
            Enter the code we sent to {status.email}. It is valid for 30
            minutes.
          </Text>
          <Box alignItems="center" columnGap="s">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="one-time-code"
            />
            <Button
              type="button"
              size="sm"
              loading={verify.isPending}
              disabled={code.length !== 6}
              onClick={onVerify}
            >
              Verify
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={sendCode.isPending}
              disabled={resendLocked}
              onClick={onSend}
            >
              Resend
            </Button>
          </Box>
        </>
      ) : (
        <Box alignItems="center" justifyContent="between" columnGap="s">
          <Text color="muted">
            Prove you read {status.email}: we send a code there, you type it
            here.
          </Text>
          <Button
            type="button"
            size="sm"
            loading={sendCode.isPending}
            onClick={onSend}
          >
            Send code
          </Button>
        </Box>
      )}
    </Box>
  )
}
