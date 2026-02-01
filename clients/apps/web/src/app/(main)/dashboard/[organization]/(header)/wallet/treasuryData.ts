/**
 * Spaire Global Wallet - Treasury & Issuing Data Layer
 *
 * Mock data layer for Stripe Treasury (Financial Accounts) and Issuing (Cards).
 * Designed for Stripe Sandbox testing with production-ready types.
 *
 * Reference: https://stripe.com/financial-accounts/platforms
 */

// ============================================================================
// TREASURY TYPES - Financial Accounts for Platforms
// ============================================================================

export interface TreasuryBalance {
  /** Available balance that can be spent or transferred */
  available: number
  /** Funds pending from outbound transfers */
  outbound_pending: number
  /** Funds pending from inbound transfers */
  inbound_pending: number
  /** Currency code (lowercase) */
  currency: string
}

export interface FinancialAccount {
  id: string
  object: 'treasury.financial_account'
  active_features: string[]
  balance: TreasuryBalance
  country: string
  created: number
  supported_currencies: string[]
  status: 'open' | 'closed'
  status_details: {
    closed?: { reasons: string[] }
  }
  /** Routing numbers for receiving funds */
  financial_addresses: FinancialAddress[]
  livemode: boolean
}

export interface FinancialAddress {
  type: 'aba'
  supported_networks: ('ach' | 'us_domestic_wire')[]
  aba: {
    account_holder_name: string
    account_number: string
    account_number_last4: string
    bank_name: string
    routing_number: string
  }
}

export interface OutboundTransfer {
  id: string
  object: 'treasury.outbound_transfer'
  amount: number
  currency: string
  description: string
  destination_payment_method: string
  expected_arrival_date: number
  financial_account: string
  status: 'processing' | 'posted' | 'failed' | 'canceled' | 'returned'
  created: number
}

export interface InboundTransfer {
  id: string
  object: 'treasury.inbound_transfer'
  amount: number
  currency: string
  description: string
  origin_payment_method: string
  financial_account: string
  status: 'processing' | 'succeeded' | 'failed' | 'canceled'
  created: number
}

export interface Transaction {
  id: string
  object: 'treasury.transaction'
  amount: number
  currency: string
  description: string
  financial_account: string
  flow_type:
    | 'inbound_transfer'
    | 'outbound_transfer'
    | 'outbound_payment'
    | 'received_credit'
    | 'received_debit'
    | 'issuing_authorization'
  status: 'open' | 'posted' | 'void'
  created: number
  /** Counterparty info */
  flow_details?: {
    type: string
    inbound_transfer?: { id: string }
    outbound_transfer?: { id: string }
    issuing_authorization?: { id: string; merchant_name: string }
  }
}

// ============================================================================
// ISSUING TYPES - Spaire Card
// ============================================================================

export interface IssuingCard {
  id: string
  object: 'issuing.card'
  brand: 'Visa' | 'Mastercard'
  cardholder: {
    id: string
    name: string
    email: string
  }
  created: number
  currency: string
  exp_month: number
  exp_year: number
  last4: string
  livemode: boolean
  status: 'active' | 'inactive' | 'canceled'
  type: 'virtual' | 'physical'
  spending_controls: SpendingControls
  /** Only available when expanded/decrypted */
  number?: string
  cvc?: string
}

export interface SpendingControls {
  allowed_categories: string[] | null
  blocked_categories: string[] | null
  spending_limits: SpendingLimit[]
  spending_limits_currency: string
}

export interface SpendingLimit {
  amount: number
  categories: string[] | null
  interval: 'per_authorization' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time'
}

export interface IssuingAuthorization {
  id: string
  object: 'issuing.authorization'
  amount: number
  currency: string
  merchant_data: {
    name: string
    category: string
    city: string
    country: string
  }
  status: 'pending' | 'closed' | 'reversed'
  approved: boolean
  created: number
  card: string
}

// ============================================================================
// WALLET STATE
// ============================================================================

export interface WalletState {
  financialAccount: FinancialAccount | null
  card: IssuingCard | null
  recentTransactions: Transaction[]
  isLoading: boolean
  error: string | null
}

// ============================================================================
// MOCK DATA - Stripe Sandbox
// ============================================================================

export const mockFinancialAccount: FinancialAccount = {
  id: 'fa_1234567890abcdef',
  object: 'treasury.financial_account',
  active_features: [
    'financial_addresses.aba',
    'inbound_transfers.ach',
    'outbound_transfers.ach',
    'outbound_transfers.us_domestic_wire',
    'outbound_payments.ach',
    'outbound_payments.us_domestic_wire',
  ],
  balance: {
    available: 0, // $0.00
    outbound_pending: 0, // $0.00
    inbound_pending: 0, // $0.00
    currency: 'usd',
  },
  country: 'US',
  created: Date.now() / 1000 - 86400 * 30, // 30 days ago
  supported_currencies: ['usd'],
  status: 'open',
  status_details: {},
  financial_addresses: [
    {
      type: 'aba',
      supported_networks: ['ach', 'us_domestic_wire'],
      aba: {
        account_holder_name: 'Spaire Incorporated',
        account_number: '000000000001',
        account_number_last4: '0001',
        bank_name: 'Stripe Treasury',
        routing_number: '110000000',
      },
    },
  ],
  livemode: false,
}

export const mockIssuingCard: IssuingCard = {
  id: 'ic_1234567890abcdef',
  object: 'issuing.card',
  brand: 'Visa',
  cardholder: {
    id: 'ich_1234567890abcdef',
    name: 'SPAIRE INCORPORATED',
    email: 'treasury@spairehq.com',
  },
  created: Date.now() / 1000 - 86400 * 14, // 14 days ago
  currency: 'usd',
  exp_month: 12,
  exp_year: 2028,
  last4: '4242',
  livemode: false,
  status: 'active',
  type: 'virtual',
  spending_controls: {
    allowed_categories: null, // All categories allowed
    blocked_categories: ['gambling'],
    spending_limits: [
      {
        amount: 1000000, // $10,000
        categories: null,
        interval: 'daily',
      },
      {
        amount: 5000000, // $50,000
        categories: null,
        interval: 'monthly',
      },
    ],
    spending_limits_currency: 'usd',
  },
  // Decrypted card details (sandbox only)
  number: '4000 0566 5566 5556',
  cvc: '123',
}

// Empty transactions - no mock data
export const mockTransactions: Transaction[] = []

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatCurrency(
  amount: number,
  currency: string = 'usd',
): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return formatter.format(amount / 100)
}

export function formatCompactCurrency(
  amount: number,
  currency: string = 'usd',
): string {
  const absAmount = Math.abs(amount / 100)
  if (absAmount >= 1000000) {
    return `$${(absAmount / 1000000).toFixed(1)}M`
  }
  if (absAmount >= 1000) {
    return `$${(absAmount / 1000).toFixed(1)}K`
  }
  return formatCurrency(amount, currency)
}

export function getTransactionIcon(flowType: Transaction['flow_type']): string {
  switch (flowType) {
    case 'inbound_transfer':
    case 'received_credit':
      return 'arrow-down-left'
    case 'outbound_transfer':
    case 'outbound_payment':
      return 'arrow-up-right'
    case 'issuing_authorization':
      return 'credit-card'
    case 'received_debit':
      return 'arrow-up-right'
    default:
      return 'circle'
  }
}

export function getRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(timestamp * 1000).toLocaleDateString()
}
