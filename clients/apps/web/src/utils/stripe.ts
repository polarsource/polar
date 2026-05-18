import { loadStripe } from '@stripe/stripe-js'
import { CONFIG } from './config'

export const loadPolarStripe = () =>
  loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '', {
    developerTools: {
      assistant: { enabled: CONFIG.ENVIRONMENT === 'development' },
    },
  })
