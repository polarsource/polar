import { loadStripe } from '@stripe/stripe-js'
import { CONFIG } from './config'

export const loadPolarStripe = () =>
  loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_KEY || '',
    CONFIG.IS_SANDBOX
      ? { developerTools: { assistant: { enabled: false } } }
      : undefined,
  )
