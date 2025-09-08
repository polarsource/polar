'use client'

import { useTwoFactorDisable, useTwoFactorStatus } from '@/hooks/twoFactor'
import { Security } from '@mui/icons-material'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useCallback, useEffect, useState } from 'react'
import TwoFactorSetup from './TwoFactorSetup'

interface TwoFactorAuthenticationMethodProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle: React.ReactNode
  action: React.ReactNode
}

const TwoFactorAuthenticationMethod: React.FC<
  TwoFactorAuthenticationMethodProps
> = ({ icon, title, subtitle, action }) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
      <div>{icon}</div>
      <div className="grow">
        <div className="font-medium">{title}</div>
        <div className="dark:text-polar-500 text-sm text-gray-500">
          {subtitle}
        </div>
      </div>
      <div>{action}</div>
    </div>
  )
}

interface TwoFactorStatus {
  enabled: boolean
  backup_codes_remaining?: number
}

const TwoFactorAuthenticationSettings = () => {
  const [showSetup, setShowSetup] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [twoFactorStatus, setTwoFactorStatus] =
    useState<TwoFactorStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getTwoFactorStatus = useTwoFactorStatus()
  const disableTwoFactor = useTwoFactorDisable()

  const fetchTwoFactorStatus = useCallback(async () => {
    try {
      const data = await getTwoFactorStatus()
      setTwoFactorStatus(data)
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err)
    }
  }, [getTwoFactorStatus])

  useEffect(() => {
    fetchTwoFactorStatus()
  }, [fetchTwoFactorStatus])

  const handleDisable2FA = async () => {
    if (
      !disableCode ||
      (disableCode.length !== 6 && disableCode.length !== 8) ||
      (disableCode.length === 6 && !/^\d{6}$/.test(disableCode)) ||
      (disableCode.length === 8 && !/^[A-Z0-9]{8}$/.test(disableCode))
    ) {
      setError(
        'Please enter a valid 6-digit authenticator code or 8-character backup code',
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      await disableTwoFactor(disableCode)
      setTwoFactorStatus({ enabled: false })
      setShowDisableForm(false)
      setDisableCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupComplete = () => {
    setShowSetup(false)
    fetchTwoFactorStatus()
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={handleSetupComplete}
        onCancel={() => setShowSetup(false)}
      />
    )
  }

  const getTitle = () => {
    if (twoFactorStatus?.enabled) {
      return 'Two-Factor Authentication Enabled'
    }
    return 'Two-Factor Authentication'
  }

  const getSubtitle = () => {
    if (twoFactorStatus?.enabled) {
      if (showDisableForm) {
        return 'Enter a code from your authenticator app to disable 2FA'
      }
      return 'Your account is protected with two-factor authentication'
    }
    return 'Add an extra layer of security to your account with 2FA'
  }

  const getAction = () => {
    if (twoFactorStatus?.enabled) {
      if (showDisableForm) {
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowDisableForm(false)
                setDisableCode('')
                setError('')
              }}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        )
      }

      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDisableForm(true)}
            disabled={loading}
            size="sm"
          >
            Disable
          </Button>
        </div>
      )
    }

    return (
      <Button onClick={() => setShowSetup(true)} size="sm">
        Enable 2FA
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <TwoFactorAuthenticationMethod
        icon={<Security />}
        title={getTitle()}
        subtitle={getSubtitle()}
        action={getAction()}
      />

      {twoFactorStatus?.enabled && (
        <div className="dark:text-polar-400 ml-8 text-xs text-gray-500">
          {twoFactorStatus.backup_codes_remaining !== undefined && (
            <p>
              Backup codes remaining: {twoFactorStatus.backup_codes_remaining}
            </p>
          )}
        </div>
      )}

      {showDisableForm && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Enter a code to disable 2FA
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Use a 6-digit code from your authenticator app or an 8-character
              backup code
            </p>
            <Input
              type="text"
              placeholder="6-digit code or backup code"
              value={disableCode}
              onChange={(e) => {
                const value = e.target.value.toUpperCase()

                if (/^\d+$/.test(value)) {
                  setDisableCode(value.slice(0, 6))
                }
                else {
                  setDisableCode(value.replace(/[^A-Z0-9]/g, '').slice(0, 8))
                }
              }}
              className="text-center"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleDisable2FA}
              disabled={
                loading ||
                disableCode.length < 6 ||
                (disableCode.length === 6 && !/^\d{6}$/.test(disableCode)) ||
                (disableCode.length > 6 && disableCode.length !== 8)
              }
              size="sm"
              variant="destructive"
              className="flex-1"
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
            <Button
              onClick={() => {
                setShowDisableForm(false)
                setDisableCode('')
                setError('')
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TwoFactorAuthenticationSettings
