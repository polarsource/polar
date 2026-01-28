'use client'

import { toast } from '@/components/Toast/use-toast'
import { getServerURL } from '@/utils/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import { loadStripe } from '@stripe/stripe-js'
import { useCallback, useEffect, useState } from 'react'
import { BankAccountCard } from './BankAccountCard'
import { RTPEligibilityBadge } from './RTPEligibilityBadge'

// Temporary API helper until OpenAPI types are regenerated
const bankLinkingApi = {
  async getStatus(accountId: string): Promise<BankLinkingStatus> {
    const res = await fetch(
      `${getServerURL()}/v1/bank-linking/status/${accountId}`,
      { credentials: 'include' },
    )
    if (!res.ok) throw new Error('Failed to fetch status')
    return res.json()
  },

  async createSession(
    accountId: string,
    returnUrl: string,
  ): Promise<{ client_secret: string }> {
    const res = await fetch(`${getServerURL()}/v1/bank-linking/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ account_id: accountId, return_url: returnUrl }),
    })
    if (!res.ok) throw new Error('Failed to create session')
    return res.json()
  },

  async complete(
    accountId: string,
    financialConnectionsAccountId: string,
  ): Promise<BankAccountInfo> {
    const res = await fetch(`${getServerURL()}/v1/bank-linking/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        account_id: accountId,
        financial_connections_account_id: financialConnectionsAccountId,
      }),
    })
    if (!res.ok) throw new Error('Failed to complete linking')
    return res.json()
  },

  async disconnect(accountId: string): Promise<void> {
    const res = await fetch(
      `${getServerURL()}/v1/bank-linking/${accountId}`,
      { method: 'DELETE', credentials: 'include' },
    )
    if (!res.ok) throw new Error('Failed to disconnect')
  },
}

interface ConnectBankAccountProps {
  accountId: string
  returnUrl: string
  onSuccess?: (bankInfo: BankAccountInfo) => void
  onError?: (error: Error) => void
}

export interface BankAccountInfo {
  id: string
  account_id: string
  bank_name: string | null
  account_type: string
  account_number_last4: string
  routing_number_last4: string
  verified_at: string
  is_rtp_eligible: boolean
  mercury_recipient_id: string | null
}

interface BankLinkingStatus {
  has_linked_bank: boolean
  bank_account: BankAccountInfo | null
  is_rtp_eligible: boolean
  is_mercury_ready: boolean
}

type ConnectionState =
  | 'idle'
  | 'loading'
  | 'connecting'
  | 'completing'
  | 'success'
  | 'error'

/**
 * ConnectBankAccount component for linking bank accounts via Stripe Financial Connections.
 *
 * This component:
 * 1. Creates a Financial Connections session
 * 2. Opens the Stripe bank linking modal
 * 3. Handles completion and creates Mercury recipient
 * 4. Shows RTP eligibility status
 */
export const ConnectBankAccount = ({
  accountId,
  returnUrl,
  onSuccess,
  onError,
}: ConnectBankAccountProps) => {
  const [state, setState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [bankStatus, setBankStatus] = useState<BankLinkingStatus | null>(null)
  const [stripePromise] = useState(() =>
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || ''),
  )

  // Fetch current bank linking status
  const fetchStatus = useCallback(async () => {
    try {
      const status = await bankLinkingApi.getStatus(accountId)
      setBankStatus(status)
      return status
    } catch (err) {
      console.error('Failed to fetch bank linking status:', err)
      return null
    }
  }, [accountId])

  // Fetch status on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Start the bank linking flow
  const startBankLinking = useCallback(async () => {
    setState('loading')
    setError(null)

    try {
      // 1. Create Financial Connections session
      const session = await bankLinkingApi.createSession(accountId, returnUrl)

      // 2. Load Stripe
      const stripe = await stripePromise
      if (!stripe) {
        throw new Error('Failed to load Stripe')
      }

      setState('connecting')

      // 3. Open Financial Connections modal
      const result = await stripe.collectFinancialConnectionsAccounts({
        clientSecret: session.client_secret,
      })

      // 4. Handle errors from Stripe
      if (result.error) {
        // User closed modal or other error
        if (result.error.type === 'validation_error') {
          throw new Error(result.error.message || 'Invalid bank account details')
        }
        // User closed modal - not a real error
        setState('idle')
        toast({
          title: 'Bank linking cancelled',
          description: "You can try again whenever you're ready.",
        })
        return
      }

      // 5. Handle user abandonment (no accounts selected)
      const accounts = result.financialConnectionsSession?.accounts
      if (!accounts || accounts.length === 0) {
        setState('idle')
        toast({
          title: 'Bank linking cancelled',
          description: "You can try again whenever you're ready.",
        })
        return
      }

      // 6. Get the first linked account
      const linkedAccount = accounts[0]

      setState('completing')

      // 7. Complete the linking on our backend
      const bankInfo = await bankLinkingApi.complete(accountId, linkedAccount.id)

      setState('success')
      setBankStatus({
        has_linked_bank: true,
        bank_account: bankInfo,
        is_rtp_eligible: bankInfo.is_rtp_eligible,
        is_mercury_ready: !!bankInfo.mercury_recipient_id,
      })

      // Show success toast with RTP status
      if (bankInfo.is_rtp_eligible) {
        toast({
          title: 'Instant Payouts Enabled!',
          description: `Your ${bankInfo.bank_name || 'bank account'} supports Real-Time Payments. Payouts will arrive in seconds.`,
        })
      } else {
        toast({
          title: 'Bank account linked',
          description: `Your ${bankInfo.bank_name || 'bank account'} has been linked. Payouts will arrive same-day via ACH.`,
        })
      }

      onSuccess?.(bankInfo)
    } catch (err) {
      setState('error')
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to link bank account'
      setError(errorMessage)

      toast({
        title: 'Bank linking failed',
        description: errorMessage,
        variant: 'error',
      })

      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }, [accountId, returnUrl, stripePromise, onSuccess, onError])

  // Disconnect bank account
  const disconnectBank = useCallback(async () => {
    if (!confirm('Are you sure you want to disconnect your bank account?')) {
      return
    }

    try {
      await bankLinkingApi.disconnect(accountId)

      setBankStatus(null)
      setState('idle')

      toast({
        title: 'Bank disconnected',
        description: 'Your bank account has been disconnected.',
      })
    } catch (err) {
      toast({
        title: 'Failed to disconnect',
        description: 'Please try again later.',
        variant: 'error',
      })
    }
  }, [accountId])

  // Render connected state
  if (bankStatus?.has_linked_bank && bankStatus.bank_account) {
    return (
      <div className="flex flex-col gap-4">
        <BankAccountCard
          bankAccount={bankStatus.bank_account}
          onDisconnect={disconnectBank}
        />
        {bankStatus.is_rtp_eligible && (
          <RTPEligibilityBadge eligible={true} />
        )}
        {!bankStatus.is_mercury_ready && (
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Setting up instant payouts... This may take a moment.
          </p>
        )}
      </div>
    )
  }

  // Render connection UI
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">Connect Your Bank Account</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Link your bank account to receive instant payouts. Mercury bank
          customers get Real-Time Payments (seconds), everyone else gets
          Same-Day ACH.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={startBankLinking}
        loading={state === 'loading' || state === 'connecting' || state === 'completing'}
        disabled={state !== 'idle' && state !== 'error'}
      >
        {state === 'loading' && 'Preparing...'}
        {state === 'connecting' && 'Connecting to your bank...'}
        {state === 'completing' && 'Setting up instant payouts...'}
        {(state === 'idle' || state === 'error') && 'Connect Bank Account'}
        {state === 'success' && 'Connected!'}
      </Button>

      <p className="text-xs text-gray-500 dark:text-gray-500">
        Secured by Stripe. We never store your bank login credentials.
      </p>
    </div>
  )
}

export default ConnectBankAccount
