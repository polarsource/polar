'use client'

import { useTwoFactorEnable, useTwoFactorSetup } from '@/hooks/twoFactor'
import { Security } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import Image from 'next/image'
import { useState } from 'react'

interface TwoFactorSetupProps {
  onComplete?: () => void
  onCancel?: () => void
}

interface SetupData {
  secret: string
  qr_code: string
  backup_codes: string[]
}

export default function TwoFactorSetup({
  onComplete,
  onCancel,
}: TwoFactorSetupProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup')
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const twoFactorSetup = useTwoFactorSetup()
  const twoFactorEnable = useTwoFactorEnable()

  const handleSetup = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await twoFactorSetup()
      setSetupData(data)
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    setLoading(true)
    setError('')

    try {
      await twoFactorEnable(verificationCode)
      setStep('backup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadBackupCodes = () => {
    if (!setupData) return

    const content = `Polar 2FA Backup Codes\n\nSave these codes in a safe place. Each code can only be used once.\n\n${setupData.backup_codes.join('\n')}\n\nGenerated: ${new Date().toISOString()}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'polar-2fa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleComplete = () => {
    onComplete?.()
  }

  if (step === 'setup') {
    return (
      <div className="dark:bg-polar-950 mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800">
        <div className="mb-6 text-center">
          <Security className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          <h2 className="mb-2 text-xl font-semibold">
            Set Up Two-Factor Authentication
          </h2>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Secure your account with an additional layer of protection using an
            authenticator app.
          </p>
        </div>

        <div className="mb-6">
          <div className="dark:text-polar-300 space-y-2 text-sm text-gray-600">
            <p>You&apos;ll need an authenticator app such as:</p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSetup} disabled={loading} className="flex-1">
            {loading ? 'Setting up...' : 'Continue'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'verify') {
    return (
      <div className="dark:bg-polar-950 mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800">
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-xl font-semibold">Scan QR Code</h2>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Scan this QR code with your authenticator app, then enter the
            6-digit code to verify.
          </p>
        </div>

        {setupData && (
          <div className="mb-6 text-center">
            <div className="mb-4 inline-block rounded-lg border bg-white p-4">
              <Image
                src={`data:image/png;base64,${setupData.qr_code}`}
                alt="2FA QR Code"
                width={192}
                height={192}
                className="h-48 w-48"
              />
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Verification Code</label>
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/\D/g, '').slice(0, 6),
                )
              }
              className="text-center text-lg tracking-widest"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </Button>
            <Button variant="outline" onClick={() => setStep('setup')}>
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'backup') {
    return (
      <div className="dark:bg-polar-950 mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800">
        <div className="mb-6 text-center">
          <h2 className="mb-2 text-xl font-semibold text-green-600">
            2FA Enabled Successfully!
          </h2>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Save your backup codes in a safe place. You can use these if you
            lose access to your authenticator app.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
          <p>
            <strong>Important:</strong> Each backup code can only be used once.
            Store them securely and don&apos;t share them.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Backup Codes</label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBackupCodes(!showBackupCodes)}
              >
                {showBackupCodes ? 'Hide' : 'Show'}
              </Button>
            </div>

            {showBackupCodes && setupData && (
              <div className="dark:bg-polar-900 rounded border bg-gray-50 p-3">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backup_codes.map((code, index) => (
                    <div
                      key={index}
                      className="dark:bg-polar-950 rounded border bg-white p-2 text-center"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(setupData.backup_codes.join('\n'))
                    }
                    className="flex-1"
                  >
                    Copy All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadBackupCodes}
                    className="flex-1"
                  >
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleComplete} className="w-full">
            Complete Setup
          </Button>
        </div>
      </div>
    )
  }

  return null
}
