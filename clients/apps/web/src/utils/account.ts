import ManualPayout from '@/components/Icons/ManualPayout'
import Stripe from '@/components/Icons/Stripe'
import { schemas } from '@polar-sh/client'

export const ACCOUNT_TYPE_DISPLAY_NAMES: Record<
  schemas['AccountType'],
  string
> = {
  stripe: 'Stripe',
  manual: 'Manual',
}
export const ACCOUNT_TYPE_ICON: Record<schemas['AccountType'], React.FC> = {
  stripe: Stripe,
  manual: ManualPayout,
}
