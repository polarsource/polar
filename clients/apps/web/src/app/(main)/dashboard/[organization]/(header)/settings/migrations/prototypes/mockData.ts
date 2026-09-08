export const mockMigration = {
  sourceAccount: 'acct_pepy_2026',
  subscriptions: {
    total: 841,
    eligible: 812,
    decisions: 7,
    stripe: 22,
    polar: 0,
    unknown: 0,
  },
  cards: {
    matching: 806,
    customerAction: 6,
  },
  transfer: {
    selected: 10,
    moved: 9,
    stripe: 1,
    recovery: 0,
    monthlyValue: '$190',
    renewalWindow: 'Sep 11–18',
  },
  decisions: [
    {
      title: 'Map Stripe Pro to Polar Pro',
      detail: '124 subscriptions · $19/month · benefits differ',
      kind: 'Product',
    },
    {
      title: 'Confirm 5 customer identities',
      detail: 'Email matches require confirmation',
      kind: 'Identity',
    },
    {
      title: 'Confirm 2 billing countries',
      detail: 'Issuer country is only a suggestion',
      kind: 'Tax',
    },
  ],
} as const

export const flowSteps = [
  'Create',
  'Assess',
  'Resolve',
  'Cards',
  'Transfer',
  'Receipt',
] as const
