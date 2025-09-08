'use client'

import { getServerURL } from '@/utils/api'
import { useCallback } from 'react'

export interface TwoFactorSetupResponse {
  secret: string
  qr_code: string
  backup_codes: string[]
}

export interface TwoFactorStatusResponse {
  enabled: boolean
  backup_codes_remaining?: number
}

const handleApiError = async (
  response: Response,
  defaultMessage: string,
  context: string,
) => {
  if (!response.ok) {
    const errorBody = await response
      .text()
      .catch(() => 'Unable to read error body')
    console.error(`2FA API Error [${context}]:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body: errorBody,
    })

    if (response.status === 404) {
      throw new Error(`${context}: Endpoint not found (${response.status})`)
    }
    if (response.status === 400) {
      try {
        const errorData = JSON.parse(errorBody)
        throw new Error(errorData.detail || defaultMessage)
      } catch {
        throw new Error(defaultMessage)
      }
    }
    throw new Error(`${defaultMessage} (${response.status})`)
  }
}

export const useTwoFactorSetup = () => {
  const setup = useCallback(async (): Promise<TwoFactorSetupResponse> => {
    console.log('2FA Setup: Starting setup request')

    const response = await fetch(getServerURL('/v1/users/2fa/setup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })

    await handleApiError(response, 'Failed to setup 2FA', 'Setup')
    const data = await response.json()

    console.log('2FA Setup: Setup successful', {
      hasSecret: !!data.secret,
      hasQR: !!data.qr_code,
      backupCodesCount: data.backup_codes?.length,
    })
    return data
  }, [])

  return setup
}

export const useTwoFactorEnable = () => {
  const enable = useCallback(async (verificationCode: string) => {
    console.log('2FA Enable: Starting enable request')

    const response = await fetch(getServerURL('/v1/users/2fa/enable'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ verification_code: verificationCode }),
    })

    await handleApiError(response, 'Invalid verification code', 'Enable')
    const data = await response.json()

    console.log('2FA Enable: Enable successful', data)
    return data
  }, [])

  return enable
}

export const useTwoFactorStatus = () => {
  const getStatus = useCallback(async (): Promise<TwoFactorStatusResponse> => {
    console.log('2FA Status: Fetching status')

    const response = await fetch(getServerURL('/v1/users/2fa/status'), {
      credentials: 'include',
    })

    await handleApiError(response, 'Failed to fetch 2FA status', 'Status')
    const data = await response.json()

    console.log('2FA Status: Status fetched', data)
    return data
  }, [])

  return getStatus
}

export const useTwoFactorDisable = () => {
  const disable = useCallback(async (verificationCode: string) => {
    console.log('2FA Disable: Starting disable request')

    const response = await fetch(getServerURL('/v1/users/2fa/disable'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ verification_code: verificationCode }),
    })

    await handleApiError(response, 'Failed to disable 2FA', 'Disable')
    const data = await response.json()

    console.log('2FA Disable: Disable successful', data)
    return data
  }, [])

  return disable
} 
export const useTwoFactorVerifyLogin = () => {
  const verify = useCallback(
    async (email: string, code: string, returnTo?: string) => {
      const formData = new FormData()
      formData.append('email', email)
      formData.append('code', code)
      if (returnTo) formData.append('return_to', returnTo)

      const response = await fetch(getServerURL('/v1/users/2fa/verify-login'), {
        method: 'POST',
        body: formData,
      })

      await handleApiError(response, 'Invalid verification code', 'Enable')
      return response
    },
    [],
  )

  return verify
}
