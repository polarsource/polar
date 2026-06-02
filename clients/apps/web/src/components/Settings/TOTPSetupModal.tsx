'use client'

import { Modal } from '@/components/Modal'
import { useTOTPEnroll, useTOTPEnable } from '@/hooks/auth'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'
import QRCode from 'react-qr-code'
import { useState } from 'react'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { toast } from '../Toast/use-toast'

export interface TOTPSetupModalProps {
  isShown: boolean
  hide: () => void
  onEnabled: () => void
}

const TOTPSetupContent = ({ onEnabled }: { onEnabled: () => void }) => {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<
    schemas['TOTPEnrollment'] | null
  >(null)

  const [manualEntryMode, setManualEntryMode] = useState(false)

  const totpEnroll = useTOTPEnroll()
  const totpEnable = useTOTPEnable()

  const renderContent = () => {
    if (!enrollment) {
      return (
        <div className="flex flex-col gap-6 p-8">
          <p className="dark:text-polar-400 text-sm text-gray-600">
            To set this up, you&rsquo;ll need an authenticator app like Google
            Authenticator or Authy.
          </p>
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
          <Button onClick={handleEnroll} loading={totpEnroll.isPending}>
            Get Started
          </Button>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="dark:text-polar-400 text-sm text-gray-600">
          Scan this QR code with your authenticator app, then enter the 6-digit
          code it generates.
        </p>

        <div className="flex flex-col items-center gap-0">
          <div className="dark:bg-polar-800 flex justify-center rounded-lg bg-white p-4">
            <QRCode value={enrollment.provisioning_uri} size={200} />
          </div>

          <button
            className="dark:text-polar-500 dark:hover:text-polar-400 mx-auto cursor-pointer appearance-none p-2 text-center text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setManualEntryMode(!manualEntryMode)}
          >
            Can&rsquo;t scan?{' '}
            {manualEntryMode
              ? 'Enter this code manually:'
              : 'Get a code to enter manually.'}
          </button>

          {manualEntryMode && (
            <div className="w-full pt-2">
              <CopyToClipboardInput
                value={enrollment.provisioning_uri}
                buttonLabel="Copy"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="dark:text-polar-300 text-center text-sm font-medium text-gray-700">
            Enter the 6-digit code from your app
          </label>
          <div className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={6}
              minLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus={true}
              value={code}
              onChange={handleCodeChange}
              onComplete={handleVerify}
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
            <Button onClick={handleVerify} loading={totpEnable.isPending}>
              {totpEnable.isPending ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
          {error && (
            <p className="text-center text-sm text-red-500 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  const handleEnroll = () => {
    setError(null)
    totpEnroll.mutate(undefined, {
      onSuccess: (response) => {
        if (response.data) {
          setEnrollment(response.data)
        } else {
          setError('Failed to start TOTP setup. Please try again.')
        }
      },
      onError: (err) => setError(err.message || 'Failed to start TOTP setup'),
    })
  }

  const handleVerify = () => {
    if (!code || code.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    setError(null)
    totpEnable.mutate(code, {
      onSuccess: () => {
        toast({ title: 'Two-factor authentication enabled' })
        onEnabled()
      },
      onError: (err) =>
        setError(err.message || 'Invalid code. Please try again.'),
    })
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    if (error) setError(null)
  }

  return renderContent()
}

const TOTPSetupModal = ({ isShown, hide, onEnabled }: TOTPSetupModalProps) => {
  return (
    <Modal
      title="Set Up Two-Factor Authentication"
      isShown={isShown}
      hide={hide}
      className="md:min-w-100 lg:max-w-135"
      modalContent={
        <TOTPSetupContent key={String(isShown)} onEnabled={onEnabled} />
      }
    />
  )
}

export default TOTPSetupModal
