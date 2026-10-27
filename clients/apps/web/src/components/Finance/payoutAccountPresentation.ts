import { schemas } from '@polar-sh/client'
import {
  Banknote as BanknoteIcon,
  Check as CheckIcon,
  CircleAlert as AlertCircleIcon,
  Clock as ClockIcon,
  type LucideIcon,
  Users as UsersIcon,
} from '@polar-sh/orbit/icons'
export type PayoutAccountState =
  | 'not_connected'
  | 'managed_by_another_member'
  | schemas['PayoutAccountStatus']

type Tone = 'success' | 'warning' | 'danger' | 'pending' | 'neutral'

export interface PayoutAccountPresentation {
  state: PayoutAccountState
  tone: Tone
  icon: LucideIcon
  title: string
  description: string
}

const PRESENTATIONS: Record<
  PayoutAccountState,
  Omit<PayoutAccountPresentation, 'state'>
> = {
  not_connected: {
    tone: 'neutral',
    icon: BanknoteIcon,
    title: 'Connect payout account',
    description:
      'Connect or create a Stripe account to receive payments from your customers.',
  },
  managed_by_another_member: {
    tone: 'neutral',
    icon: UsersIcon,
    title: 'Payout account connected by another member',
    description:
      'Only the member who connected it can edit it. You can switch this organization to a payout account of your own.',
  },
  incomplete: {
    tone: 'warning',
    icon: AlertCircleIcon,
    title: 'Finish payout setup',
    description:
      'Stripe needs more information before you can receive payouts. Pick up where you left off.',
  },
  under_review: {
    tone: 'pending',
    icon: ClockIcon,
    title: 'Stripe is reviewing your account',
    description:
      'You have completed setup. Stripe is verifying your details, which usually takes a day or two. Nothing is needed from you.',
  },
  paused: {
    tone: 'danger',
    icon: AlertCircleIcon,
    title: 'Payouts are paused',
    description:
      'Stripe has paused payouts on this account. Contact support and we will look into it.',
  },
  ready: {
    tone: 'success',
    icon: CheckIcon,
    title: 'Payout account connected',
    description:
      'Your Stripe payout account is configured and ready to receive payouts.',
  },
}

export const getPayoutAccountPresentation = (
  payoutAccount: schemas['PayoutAccount'] | undefined,
  managedByAnotherMember = false,
): PayoutAccountPresentation => {
  const state: PayoutAccountState = managedByAnotherMember
    ? 'managed_by_another_member'
    : (payoutAccount?.status ?? 'not_connected')
  return { state, ...PRESENTATIONS[state] }
}
