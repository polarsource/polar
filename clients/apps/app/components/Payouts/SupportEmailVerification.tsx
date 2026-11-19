import { Banner } from '@/components/Shared/Banner'
import { Button } from '@/components/Shared/Button'
import { Input } from '@/components/Shared/Input'
import { Text } from '@/components/Shared/Text'
import {
  useSendOrganizationEmailCode,
  useVerifyOrganizationEmail,
} from '@/hooks/polar/organizationEmail'
import { useToast } from '@/providers/ToastProvider'
import { capture } from '@/utils/posthog'
import { ClientResponseError, schemas } from '@polar-sh/client'
import { useState } from 'react'

const CODE_LENGTH = 6

export interface SupportEmailVerificationProps {
  organizationId: string
  status: schemas['OrganizationEmailStatus']
}

export const SupportEmailVerification = ({
  organizationId,
  status,
}: SupportEmailVerificationProps) => {
  const toast = useToast()
  const sendCode = useSendOrganizationEmailCode(organizationId)
  const verify = useVerifyOrganizationEmail(organizationId)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!status.email) {
    return (
      <Banner
        title="Add a support email"
        description="Payouts need a verified support email. Add one from the Polar dashboard on the web."
      />
    )
  }

  const onSend = async () => {
    setError(null)
    try {
      await sendCode.mutateAsync()
      setCode('')
      setCodeSent(true)
    } catch {
      toast.showError('Failed to send the code. Please try again.')
    }
  }

  const onVerify = async (value: string) => {
    setError(null)
    try {
      await verify.mutateAsync(value)
      capture('app:finance:support_email:verify')
      toast.showSuccess(`${status.email} is verified.`)
    } catch (e) {
      const detail = e instanceof ClientResponseError ? e.error.detail : null
      setError(
        typeof detail === 'string'
          ? detail
          : 'Could not verify the code. Please try again.',
      )
    }
  }

  if (!codeSent && !status.code_pending) {
    return (
      <Banner
        title="Verify your support email"
        description={`Payouts need a verified support email. We'll send a code to ${status.email}.`}
      >
        <Button onPress={onSend} loading={sendCode.isPending}>
          Send code
        </Button>
      </Banner>
    )
  }

  return (
    <Banner
      title="Verify your support email"
      description={`Enter the code we sent to ${status.email}. It is valid for 30 minutes.`}
    >
      <Input
        value={code}
        onChangeText={(value) => {
          const next = value.toUpperCase()
          setCode(next)
          if (next.length === CODE_LENGTH) {
            onVerify(next)
          }
        }}
        maxLength={CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        editable={!verify.isPending}
        placeholder="Code"
        autoFocus
      />
      {error ? (
        <Text variant="bodySmall" color="error">
          {error}
        </Text>
      ) : null}
      <Button
        variant="secondary"
        onPress={onSend}
        loading={sendCode.isPending}
        disabled={verify.isPending}
      >
        Resend code
      </Button>
    </Banner>
  )
}
