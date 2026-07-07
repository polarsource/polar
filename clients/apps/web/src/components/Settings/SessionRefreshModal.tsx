'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useBackupCodesVerify,
  useStepUpComplete,
  useStepUpStart,
  useTOTPVerify,
} from '@/hooks/auth'
import { isSessionNotFreshError } from '@/utils/api/errors'
import { Button, Input, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'

const StepUpVerifyForm = ({
  starting,
  onVerified,
}: {
  starting: boolean
  onVerified: () => void
}) => {
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const totpVerify = useTOTPVerify()
  const backupCodesVerify = useBackupCodesVerify()
  const stepUpComplete = useStepUpComplete()

  const onSubmit = async (submittedCode: string) => {
    if (loading || submittedCode.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const { error: verifyError } = useBackupCode
        ? await backupCodesVerify.mutateAsync({ code: submittedCode })
        : await totpVerify.mutateAsync(submittedCode)
      if (verifyError) {
        setError('Invalid code. Please try again.')
        return
      }
      const { error: completeError } = await stepUpComplete.mutateAsync()
      if (completeError) {
        setError('An unexpected error occurred. Please try again.')
        return
      }
      onVerified()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode)
    setCode('')
    setError(null)
  }

  return (
    <Box flexDirection="column" rowGap="l" padding="2xl">
      <Text color="muted">
        For your security, this action requires that you verify it&apos;s you.
        Enter{' '}
        {useBackupCode
          ? 'a backup code'
          : 'the code from your authenticator app'}{' '}
        to continue.
      </Text>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(code)
        }}
      >
        <Box flexDirection="column" rowGap="l" alignItems="center">
          {useBackupCode ? (
            <Input
              type="text"
              placeholder="Backup code"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus={true}
            />
          ) : (
            <InputOTP
              maxLength={6}
              minLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              autoFocus={true}
              onChange={setCode}
              onComplete={onSubmit}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          )}
          {error && <Text color="error">{error}</Text>}
          <Button
            type="submit"
            className="w-full"
            loading={loading || starting}
          >
            Verify
          </Button>
          <Button variant="ghost" type="button" onClick={toggleBackupCode}>
            {useBackupCode
              ? 'Use your authenticator app instead'
              : 'Use a backup code instead'}
          </Button>
        </Box>
      </form>
    </Box>
  )
}

export const useSessionRefreshPrompt = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { isShown, show, hide } = useModal()
  const [mode, setMode] = useState<'starting' | 'verify' | 'relogin'>(
    'starting',
  )
  const retryRef = useRef<(() => void) | undefined>(undefined)
  const stepUpStart = useStepUpStart()

  const promptIfSessionNotFresh = useCallback(
    (error: unknown, retry?: () => void): boolean => {
      if (!isSessionNotFreshError(error)) {
        return false
      }
      retryRef.current = retry
      setMode('starting')
      show()
      stepUpStart
        .mutateAsync()
        .then(({ error: startError }) =>
          setMode(startError ? 'relogin' : 'verify'),
        )
        .catch(() => setMode('relogin'))
      return true
    },
    [show, stepUpStart],
  )

  const onVerified = useCallback(() => {
    hide()
    const retry = retryRef.current
    retryRef.current = undefined
    retry?.()
  }, [hide])

  const sessionRefreshModal =
    mode === 'relogin' ? (
      <ConfirmModal
        isShown={isShown}
        hide={hide}
        title="Please sign in again"
        description="For your security, this action requires that you signed in recently. Sign in again to continue."
        onConfirm={() =>
          router.push(`/auth?return_to=${encodeURIComponent(pathname ?? '/')}`)
        }
      />
    ) : (
      <Modal
        isShown={isShown}
        hide={hide}
        title="Confirm it's you"
        modalContent={
          <StepUpVerifyForm
            starting={mode === 'starting'}
            onVerified={onVerified}
          />
        }
      />
    )

  return { promptIfSessionNotFresh, sessionRefreshModal }
}
