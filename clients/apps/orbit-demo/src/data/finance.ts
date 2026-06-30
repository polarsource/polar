export type TransactionType = 'payment' | 'payout' | 'refund' | 'adjustment'

export type Transaction = {
  id: string
  date: string
  type: TransactionType
  description: string
  /** Gross transaction amount in cents. Positive for incoming, negative for outgoing. */
  grossCents: number
  /** Platform + processor fee in cents (always positive). */
  feeCents: number
  /** Net effect on the merchant balance in cents (signed). */
  netCents: number
}

export type FinanceSummary = {
  availableCents: number
  pendingCents: number
  lifetimeRevenueCents: number
  lifetimeFeesCents: number
  nextPayout: { amountCents: number; date: string } | null
  transactions: Transaction[]
}

export const TYPE_LABEL: Record<TransactionType, string> = {
  payment: 'Payment',
  payout: 'Payout',
  refund: 'Refund',
  adjustment: 'Adjustment',
}

export const FINANCE: FinanceSummary = {
  availableCents: 48_294_00,
  pendingCents: 4_120_00,
  lifetimeRevenueCents: 142_560_00,
  lifetimeFeesCents: 6_842_00,
  nextPayout: { amountCents: 48_294_00, date: '2026-05-23' },
  transactions: [
    {
      id: 'txn_01',
      date: '2026-05-18',
      type: 'payment',
      description: 'Bitspace Enterprise — Emil Widlund',
      grossCents: 499_00,
      feeCents: 24_47,
      netCents: 474_53,
    },
    {
      id: 'txn_02',
      date: '2026-05-17',
      type: 'payment',
      description: 'Bitspace Pro — Birk Jernström',
      grossCents: 49_00,
      feeCents: 2_72,
      netCents: 46_28,
    },
    {
      id: 'txn_03',
      date: '2026-05-16',
      type: 'payout',
      description: 'Payout to Skandinaviska Enskilda Banken',
      grossCents: -8_240_00,
      feeCents: 0,
      netCents: -8_240_00,
    },
    {
      id: 'txn_04',
      date: '2026-05-15',
      type: 'refund',
      description: 'Refund — Bitspace Startup — Mads Holm',
      grossCents: -120_00,
      feeCents: 0,
      netCents: -120_00,
    },
    {
      id: 'txn_05',
      date: '2026-05-15',
      type: 'payment',
      description: 'Bitspace Custom — Sigrid Lien',
      grossCents: 120_00,
      feeCents: 6_22,
      netCents: 113_78,
    },
    {
      id: 'txn_06',
      date: '2026-05-14',
      type: 'payment',
      description: 'Bitspace Enterprise — Acme Corp',
      grossCents: 499_00,
      feeCents: 24_47,
      netCents: 474_53,
    },
    {
      id: 'txn_07',
      date: '2026-05-12',
      type: 'adjustment',
      description: 'Dispute reversal — Bitspace Pro',
      grossCents: 49_00,
      feeCents: 0,
      netCents: 49_00,
    },
    {
      id: 'txn_08',
      date: '2026-05-09',
      type: 'payout',
      description: 'Payout to Skandinaviska Enskilda Banken',
      grossCents: -12_804_00,
      feeCents: 0,
      netCents: -12_804_00,
    },
    {
      id: 'txn_09',
      date: '2026-05-08',
      type: 'payment',
      description: 'Bitspace Pro — Lina Sjöberg',
      grossCents: 49_00,
      feeCents: 2_72,
      netCents: 46_28,
    },
    {
      id: 'txn_10',
      date: '2026-05-06',
      type: 'payment',
      description: 'Bitspace Startup — Mads Holm',
      grossCents: 120_00,
      feeCents: 6_22,
      netCents: 113_78,
    },
  ],
}

export const formatMoney = (cents: number): string => {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = abs / 100
  return `${sign}$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
