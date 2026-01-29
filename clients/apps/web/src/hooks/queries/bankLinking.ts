import { getServerURL } from '@/utils/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Types for bank linking (until OpenAPI types are regenerated)
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

export interface BankLinkingStatus {
  has_linked_bank: boolean
  bank_account: BankAccountInfo | null
  is_rtp_eligible: boolean
  is_mercury_ready: boolean
}

export interface BankLinkingSession {
  client_secret: string
}

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
  ): Promise<BankLinkingSession> {
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

export const useBankLinkingStatus = (accountId: string) => {
  return useQuery({
    queryKey: ['bankLinking', 'status', accountId],
    queryFn: () => bankLinkingApi.getStatus(accountId),
    enabled: !!accountId,
  })
}

export const useCreateBankLinkingSession = () => {
  return useMutation({
    mutationFn: ({
      accountId,
      returnUrl,
    }: {
      accountId: string
      returnUrl: string
    }) => bankLinkingApi.createSession(accountId, returnUrl),
  })
}

export const useCompleteBankLinking = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      accountId,
      financialConnectionsAccountId,
    }: {
      accountId: string
      financialConnectionsAccountId: string
    }) => bankLinkingApi.complete(accountId, financialConnectionsAccountId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['bankLinking', 'status', variables.accountId],
      })
    },
  })
}

export const useDisconnectBankAccount = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => bankLinkingApi.disconnect(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({
        queryKey: ['bankLinking', 'status', accountId],
      })
    },
  })
}
