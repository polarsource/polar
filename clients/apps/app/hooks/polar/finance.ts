import { useSession } from '@/providers/SessionProvider'
import { queryClient } from '@/utils/query'
import { schemas } from '@polar-sh/client'
import {
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query'

export enum AccountStatus {
  CREATED = 'created',
  ONBOARDING_STARTED = 'onboarding_started',
  UNDER_REVIEW = 'under_review',
  DENIED = 'denied',
  ACTIVE = 'active',
}

export enum AccountType {
  STRIPE = 'stripe',
  OPEN_COLLECTIVE = 'open_collective',
}

export interface User {
  email: string
  avatar_url: string | null
  account_id: string | null
}

export interface Address {
  line1: string | null
  line2: string | null
  postal_code: string | null
  city: string | null
  state: string | null
  country: string // Two letter country code
}

export interface OrganizationAccount {
  id: string // UUID as string
  account_type: AccountType
  status: AccountStatus
  stripe_id: string | null
  open_collective_slug: string | null
  is_details_submitted: boolean
  is_charges_enabled: boolean
  is_payouts_enabled: boolean
  country: string // Two letter country code

  billing_name: string | null
  billing_address: Address | null
  billing_additional_info: string | null
  billing_notes: string | null

  users: User[]
  organizations: schemas['Organization'][]
}

export const useOrganizationAccount = (
  organizationId?: string,
): UseQueryResult<OrganizationAccount> => {
  const { session } = useSession()
  return useQuery({
    queryKey: ['finance', 'account', organizationId],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/organizations/${organizationId}/account`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    enabled: !!organizationId,
  })
}

export enum PlatformFeeType {
  /**
   * Fee applied to a payment. This is the base fee applied to all payments.
   */
  Payment = 'payment',

  /**
   * Fee applied to an international payment, i.e. the payment method is not from the US.
   */
  InternationalPayment = 'international_payment',

  /**
   * Fee applied to a recurring subscription.
   */
  Subscription = 'subscription',

  /**
   * Fee applied to an issued invoice.
   */
  Invoice = 'invoice',

  /**
   * Fee applied by the payment processor when money is transferred
   * to a different country than Polar's.
   */
  CrossBorderTransfer = 'cross_border_transfer',

  /**
   * Fee applied by the payment processor when money
   * is paid out to the user's bank account.
   */
  Payout = 'payout',

  /**
   * Fee applied recurrently by the payment processor to an active account.
   */
  Account = 'account',

  /**
   * Fee applied when a dispute was opened on a payment.
   */
  Dispute = 'dispute',

  /**
   * Polar platform fee.
   * @deprecated We no longer have a generic platform fee. They're always associated with a specific reason.
   */
  Platform = 'platform',
}

export interface TransactionsBalance {
  currency: string
  amount: number
  account_currency: string
  account_amount: number
}

export interface TransactionsSummary {
  balance: TransactionsBalance
  payout: TransactionsBalance
}

export const useTransactionsSummary = (
  accountId?: string,
): UseQueryResult<TransactionsSummary> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['finance', accountId, 'transactions', 'summary'],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/transactions/summary?account_id=${accountId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    enabled: !!accountId,
  })
}

export interface PayoutEstimate {
  account_id: string
  gross_amount: number
  fees_amount: number
  net_amount: number
}

export enum PayoutStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  SUCCEEDED = 'succeeded',
}

export enum TransactionType {
  PAYMENT = 'payment',
  PROCESSOR_FEE = 'processor_fee',
  REFUND = 'refund',
  REFUND_REVERSAL = 'refund_reversal',
  DISPUTE = 'dispute',
  DISPUTE_REVERSAL = 'dispute_reversal',
  BALANCE = 'balance',
  PAYOUT = 'payout',
}

export interface TransactionEmbedded {
  id: string
  createdAt: Date
  type: TransactionType
  processor?: string
  currency: string
  amount: number
  account_currency: string
  account_amount: number
  platform_fee_type?: PlatformFeeType
  pledge_id?: string
  issue_reward_id?: string
  order_id?: string
  payout_transaction_id?: string
  incurred_by_transaction_id?: string
}

export interface Payout {
  id: string
  processor: string
  status: PayoutStatus
  currency: string
  amount: number
  fees_amount: number
  gross_amount: number
  account_currency: string
  account_amount: number
  account_id: string
  invoice_number: string | null
  is_invoice_generated: boolean
  transaction_id: string
  fees_transactions: TransactionEmbedded[]
  created_at: string
}

export const usePayoutEstimate = (
  accountId?: string,
): UseQueryResult<PayoutEstimate> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['finance', accountId, 'payouts', 'estimate'],
    queryFn: () =>
      fetch(
        `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/payouts/estimate?account_id=${accountId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session}`,
          },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    enabled: !!accountId,
  })
}

export const useCreatePayout = (
  accountId?: string,
): UseMutationResult<Payout> => {
  const { session } = useSession()

  return useMutation({
    mutationFn: () =>
      fetch(`${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/payouts/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        method: 'POST',
        body: JSON.stringify({
          account_id: accountId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] })
    },
  })
}

export const usePayout = (
  payoutId?: string,
): UseQueryResult<Payout | undefined> => {
  return useQuery({
    queryKey: ['finance', 'payouts', payoutId],
    queryFn: () =>
      queryClient
        .getQueryData<{
          items: Payout[]
          pagination: schemas['Pagination']
        }>(['finance', 'payouts'])
        ?.items.find((payout) => payout.id === payoutId),
    enabled: !!payoutId,
  })
}

export const usePayouts = (): UseQueryResult<{
  items: Payout[]
  pagination: schemas['Pagination']
}> => {
  const { session } = useSession()

  return useQuery({
    queryKey: ['finance', 'payouts'],
    queryFn: () =>
      fetch(`${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/payouts/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if ('error' in data && 'error_description' in data) {
            throw new Error(data.error_description as string)
          }

          return data
        }),
  })
}
