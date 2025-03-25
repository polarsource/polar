import OpenCollective from '@/components/Icons/OpenCollective'
import Stripe from '@/components/Icons/Stripe'
import { schemas } from '@polar-sh/client'

export const ALL_ACCOUNT_TYPES: schemas['AccountType'][] = [
  'stripe',
  'open_collective',
]

export const ACCOUNT_TYPE_DISPLAY_NAMES: Record<
  schemas['AccountType'],
  string
> = {
  stripe: 'Stripe',
  open_collective: 'Open Collective',
}
export const ACCOUNT_STATUS_DISPLAY_NAMES: Record<schemas['Status'], string> = {
  created: 'Onboarding incomplete',
  onboarding_started: 'Onboarding incomplete',
  under_review: 'Under review',
  active: 'Active',
  denied: 'Denied',
}

export const ACCOUNT_TYPE_ICON: Record<schemas['AccountType'], React.FC> = {
  stripe: Stripe,
  open_collective: OpenCollective,
}
