import { loadStripe } from '@stripe/stripe-js'

export const loadPolarStripe = () =>
  loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '', {
    developerTools: { assistant: { enabled: false } },
  })
