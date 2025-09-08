'use client'

import { useTwoFactorVerifyLogin } from '@/hooks/twoFactor'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@polar-sh/ui/components/ui/card'
import { HelpCircle, Shield } from 'lucide-react'
import { useState } from 'react'

interface TwoFactorVerificationProps {
  email: string
  returnTo?: string
  error?: string
}

export default function TwoFactorVerification({
  email,
  returnTo,
  error: initialError,
}: TwoFactorVerificationProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError || '')
  const [showBackupHelp, setShowBackupHelp] = useState(false)

  const verifyTwoFactor = useTwoFactorVerifyLogin()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code || code.length < 6) {
      setError('Please enter a valid code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await verifyTwoFactor(email, code, returnTo)

      if (response.redirected) {
        window.location.href = response.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 8)
    setCode(cleanValue)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="mx-4 w-full max-w-md">
        <CardHeader className="text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to continue
            signing in to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="text-center text-lg tracking-widest"
                autoComplete="one-time-code"
                autoFocus
              />
              <p className="text-center text-xs text-gray-500">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowBackupHelp(!showBackupHelp)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                <HelpCircle className="mr-1 h-4 w-4" />
                Can&#39;t access your authenticator app?
              </Button>
            </div>

            {showBackupHelp && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                <div className="space-y-2">
                  <p className="font-medium">Use a backup code instead:</p>
                  <p className="text-sm">
                    If you have backup codes saved from when you set up 2FA, you
                    can enter one of those 8-character codes above instead of
                    the 6-digit authenticator code.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Lost your backup codes? Contact support for assistance.
                  </p>
                </div>
              </div>
            )}

            <div className="text-center">
              <a
                href="/login"
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                ← Back to login
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
