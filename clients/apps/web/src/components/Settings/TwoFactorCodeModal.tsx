'use client'

import { extractApiErrorMessage } from '@/utils/api/errors'
import { Button, Input, Modal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code) return
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

  return (
    <Box
      as="form"
      flexDirection="column"
      gap="l"
      padding="2xl"
      onSubmit={handleSubmit}
    >
      <Text color="muted">{description}</Text>
      <Text color="muted">
        Enter the 6-digit code from your authenticator app, or one of your
        backup codes.
      </Text>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Authenticator code or backup code"
        autoComplete="one-time-code"
        autoFocus
      />
      {error && <Text color="danger">{error}</Text>}
      <Box justifyContent="end" gap="m">
        <Button type="button" variant="ghost" onClick={hide}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={destructive ? 'destructive' : 'default'}
          loading={submitting}
          disabled={!code}
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
