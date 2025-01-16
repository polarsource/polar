import OpenCollective from '@/components/Icons/OpenCollective'
import Stripe from '@/components/Icons/Stripe'
import { AccountType, Status } from '@polar-sh/api'

export const ALL_ACCOUNT_TYPES: AccountType[] = Object.values(AccountType)

export const ACCOUNT_TYPE_DISPLAY_NAMES: Record<AccountType, string> = {
  [AccountType.STRIPE]: 'Stripe',
  [AccountType.OPEN_COLLECTIVE]: 'Open Collective',
}
export const ACCOUNT_STATUS_DISPLAY_NAMES: Record<Status, string> = {
  [Status.CREATED]: 'Onboarding incomplete',
  [Status.ONBOARDING_STARTED]: 'Onboarding incomplete',
  [Status.UNDER_REVIEW]: 'Under review',
  [Status.ACTIVE]: 'Active',
}

export const ACCOUNT_TYPE_ICON: Record<AccountType, React.FC> = {
  [AccountType.STRIPE]: Stripe,
  [AccountType.OPEN_COLLECTIVE]: OpenCollective,
}
