import { schemas } from '@polar-sh/client'

export const platformFeesDisplayNames: {
  [key in schemas['PlatformFeeType']]: string
} = {
  payment: 'Payment Fee',
  international_payment: 'International Payment Fee',
  subscription: 'Subscription Fee',
  invoice: 'Invoice Fee',
  cross_border_transfer: 'Cross-border Transfer Payout Fee',
  payout: 'Payout Fee',
  account: 'Active Payout Account Fee',
  dispute: 'Dispute Fee',
  platform: 'Polar Fee',
  fee_credit: 'Fee Credit',
}

export const isTransaction = (
  t: schemas['Transaction'] | schemas['TransactionEmbedded'],
): t is schemas['Transaction'] =>
  // eslint-disable-next-line no-prototype-builtins
  t.hasOwnProperty('account_incurred_transactions')
