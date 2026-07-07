'use client'

import { extractApiErrorMessage } from '@/utils/api/errors'
import { Button, Input, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
import { useState } from 'react'

export interface TwoFactorCodeModalProps {
  isShown: boolean
  hide: () => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: (code: string) => Promise<{ error?: { detail?: unknown } }>
}

const TwoFactorCodeContent = ({
  hide,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: Omit<TwoFactorCodeModalProps, 'isShown' | 'title'>) => {
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useBackupCode ? code.length > 0 : code.length === 6

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setError(null)
    setSubmitting(true)
    const result = await onConfirm(code.trim().toUpperCase())
    setSubmitting(false)
    if (result.error) {
      setError(extractApiErrorMessage(result.error))
      return
    }
    hide()
  }

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode)
    setCode('')
    setError(null)
  }

  return (
    <Box
      as="form"
      flexDirection="column"
      gap="l"
      padding="2xl"
      onSubmit={handleSubmit}
    >
      <Text color="muted">{description}</Text>
      {useBackupCode ? (
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Backup code"
          autoComplete="one-time-code"
          autoFocus
        />
      ) : (
        <Box flexDirection="column" gap="m">
          <Text color="muted" align="center">
            Enter the 6-digit code from your authenticator app.
          </Text>
          <Box justifyContent="center">
            <InputOTP
              maxLength={6}
              minLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(value) => {
                setCode(value)
                if (error) setError(null)
              }}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="dark:border-polar-600 h-12 w-12 border-gray-300 text-xl"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </Box>
        </Box>
      )}
      <button
        type="button"
        className="dark:text-polar-500 dark:hover:text-polar-400 mx-auto cursor-pointer appearance-none text-center text-xs text-gray-500 hover:text-gray-700"
        onClick={toggleBackupCode}
      >
        {useBackupCode
          ? 'Use an authenticator code instead'
          : 'Use a backup code instead'}
      </button>
      {error && (
        <Text color="danger" align="center">
          {error}
        </Text>
      )}
      <Box justifyContent="end" gap="m">
        <Button type="button" variant="ghost" onClick={hide}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={destructive ? 'destructive' : 'default'}
          loading={submitting}
          disabled={!canSubmit}
        >
          {confirmLabel}
        </Button>
      </Box>
    </Box>
  )
}

const TwoFactorCodeModal = ({
  isShown,
  title,
  ...props
}: TwoFactorCodeModalProps) => {
  return (
    <Modal
      title={title}
      isShown={isShown}
      hide={props.hide}
      className="md:min-w-100 lg:max-w-135"
      modalContent={<TwoFactorCodeContent key={String(isShown)} {...props} />}
    />
  )
}

export default TwoFactorCodeModal
