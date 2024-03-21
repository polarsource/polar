export const prettyCardName = (brand?: string) => {
  if (!brand) {
    return 'Saved Card'
  }

  if (brand.toLowerCase() === 'mastercard') {
    return 'MasterCard'
  }

  return brand[0].toUpperCase() + brand.slice(1)
}

export const validateEmail = (email: string) => {
  return email.includes('@')
}

import { PaymentIntent } from '@stripe/stripe-js'

export const generateRedirectURL = (
  gotoURL?: string,
  paymentIntent?: PaymentIntent,
  email?: string,
) => {
  const redirectURL = new URL(
    window.location.origin + window.location.pathname + '/status',
  )

  if (gotoURL) {
    redirectURL.searchParams.append('goto_url', gotoURL)
  }

  if (email) {
    redirectURL.searchParams.append('email', email)
  }

  // Server side redirect
  // Search params are added by Stripe
  if (!paymentIntent) {
    return redirectURL.toString()
  }

  // Client side redirect
  redirectURL.searchParams.append('payment_intent_id', paymentIntent.id)
  if (paymentIntent.client_secret) {
    redirectURL.searchParams.append(
      'payment_intent_client_secret',
      paymentIntent.client_secret,
    )
  }
  redirectURL.searchParams.append('redirect_status', paymentIntent.status)
  return redirectURL.toString()
}
