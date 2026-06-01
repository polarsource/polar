'use client'

import { Modal } from '@/components/Modal'
import {
  useBackupCodesEnroll,
  useTOTPEnroll,
  useTOTPEnable,
  useTOTPStatus,
} from '@/hooks/auth'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import QRCode from 'react-qr-code'
import { useState } from 'react'
import Spinner from '@/components/Shared/Spinner'
import BackupCodesModal from './BackupCodesModal'
import { useModal } from '@/components/Modal/useModal'

export interface TOTPSetupModalProps {
  isShown: boolean
  hide: () => void
}

const TOTPSetupContent = () => {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<
    schemas['TOTPEnrollment'] | null
  >(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<
    string[] | null
  >(null)

  const totpStatus = useTOTPStatus()
  const totpEnroll = useTOTPEnroll()
  const totpEnable = useTOTPEnable()
  const backupCodesEnroll = useBackupCodesEnroll()

  const {
    isShown: isBackupCodesModalShown,
    show: showBackupCodesModal,
    hide: hideBackupCodesModal,
  } = useModal()

  const renderContent = () => {
    if (showSuccess) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 py-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-green-600 dark:text-green-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">
            TOTP Enabled!
          </h2>
          <p className="dark:text-polar-400 text-center text-gray-600">
            Two-factor authentication is now active on your account.
          </p>
          {backupCodesEnroll.isPending && (
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Generating backup codes...
            </p>
          )}
        </div>
      )
    }

    if (!enrollment) {
      return (
        <div className="flex flex-col gap-6 p-8">
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Add an extra layer of security to your account. You&apos;ll need an
            authenticator app such as Google Authenticator or Authy.
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
          Scan this QR code with your authenticator app (Google Authenticator,
          Authy, etc.) to get a 6-digit code.
        </p>

        <div className="dark:bg-polar-800 flex justify-center rounded-lg bg-white p-4">
          <QRCode value={enrollment.provisioning_uri} size={200} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
            Can&apos;t scan? Enter this code manually:
          </label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={enrollment.provisioning_uri}
              className="flex-1 font-mono text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(enrollment.provisioning_uri)
              }
            >
              Copy
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="dark:text-polar-300 text-sm font-medium text-gray-700">
            Enter the 6-digit code from your app:
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              placeholder="123456"
              className="flex-1"
            />
            <Button
              onClick={handleVerify}
              loading={totpEnable.isPending}
              className="min-w-[100px]"
            >
              Verify
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {totpEnable.isPending && (
          <div className="flex items-center justify-center gap-2">
            <div className="h-5 w-5 animate-spin">
              <Spinner />
            </div>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Verifying...
            </p>
          </div>
        )}
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
      onSuccess: async () => {
        setShowSuccess(true)
        totpStatus.refetch()
        // Generate backup codes after TOTP is enabled
        try {
          const result = await backupCodesEnroll.mutateAsync()
          if (result.data?.codes) {
            setGeneratedBackupCodes(result.data.codes)
            showBackupCodesModal()
          }
        } catch {
          // Backup codes generation failed, but TOTP is still enabled
          // Don't block the success flow
        }
      },
      onError: (err) =>
        setError(err.message || 'Invalid code. Please try again.'),
    })
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value)
    if (error) setError(null)
  }

  return (
    <>
      {renderContent()}
      <BackupCodesModal
        isShown={isBackupCodesModalShown}
        hide={hideBackupCodesModal}
        codes={generatedBackupCodes || []}
      />
    </>
  )
}

const TOTPSetupModal = ({ isShown, hide }: TOTPSetupModalProps) => {
  return (
    <Modal
      title="Set Up Two-Factor Authentication"
      isShown={isShown}
      hide={hide}
      className="md:min-w-[400px] lg:max-w-[540px]"
      modalContent={<TOTPSetupContent key={String(isShown)} />}
    />
  )
}

export default TOTPSetupModal
