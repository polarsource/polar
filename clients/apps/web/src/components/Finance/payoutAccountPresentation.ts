import { schemas } from '@polar-sh/client'
import {
  AlertCircleIcon,
  BanknoteIcon,
  CheckIcon,
  ClockIcon,
  type LucideIcon,
} from 'lucide-react'

export type PayoutAccountState =
  | 'not_connected'
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
): PayoutAccountPresentation => {
  const state: PayoutAccountState = payoutAccount?.status ?? 'not_connected'
  return { state, ...PRESENTATIONS[state] }
}
