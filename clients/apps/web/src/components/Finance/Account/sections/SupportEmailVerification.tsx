'use client'

import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useOrganizationEmail,
  useSendOrganizationEmailCode,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { Modal } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CircleAlert, CircleCheck, Clock } from '@polar-sh/orbit/icons'
import { useState } from 'react'
import { SupportEmailVerifyFlow } from './SupportEmailVerifyFlow'

type Tone = 'danger' | 'warning'

interface Props {
  organization: schemas['Organization']
  tone?: Tone
}

export const SupportEmailStatusIcon = ({
  organization,
  tone = 'danger',
}: Props) => {
  const { data: status } = useOrganizationEmail(organization.id)
  if (!status?.email) return null
  if (status.verified) {
    return (
      <Box as="span" display="flex" color="text-success">
        <CircleCheck className="h-4 w-4" />
      </Box>
    )
  }
  return (
    <Box
      as="span"
      display="flex"
      color={tone === 'danger' ? 'text-danger' : 'text-warning'}
    >
      {tone === 'danger' ? (
        <CircleAlert className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
    </Box>
  )
}

export const SupportEmailVerifyPrompt = ({
  organization,
  tone = 'danger',
}: Props) => {
  const { data: status } = useOrganizationEmail(organization.id)
  const sendCode = useSendOrganizationEmailCode(organization.id)
  const { isShown, show, hide } = useModal()
  const [codeJustSent, setCodeJustSent] = useState(false)
  if (!status?.email || status.verified) return null

  const onVerifyNow = async () => {
    const sending = !status.code_pending
    if (sending) {
      const { error } = await sendCode.mutateAsync()
      if (error) {
        toast({
          title: 'Failed to send the code',
          description: extractApiErrorMessage(error, 'Please try again.'),
        })
        return
      }
    }
    setCodeJustSent(sending)
    show()
  }

  return (
    <>
      <Box color={tone === 'danger' ? 'text-danger' : 'text-warning'}>
        <p className="text-xs">
          {tone === 'danger'
            ? 'This email is not verified.'
            : "This email isn't verified yet."}{' '}
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2 disabled:cursor-default disabled:opacity-60"
            disabled={sendCode.isPending}
            onClick={onVerifyNow}
          >
            {sendCode.isPending ? 'Sending code…' : 'Verify now'}
          </button>
        </p>
      </Box>
      <Modal
        title="Verify your support email"
        isShown={isShown}
        hide={hide}
        className="md:min-w-100 lg:max-w-135"
        modalContent={
          <Box flexDirection="column" padding="2xl">
            <SupportEmailVerifyFlow
              organization={organization}
              codeJustSent={codeJustSent}
              onVerified={hide}
            />
          </Box>
        }
      />
    </>
  )
}
