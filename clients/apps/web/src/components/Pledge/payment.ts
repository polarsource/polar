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

  // Only in case we pass our redirect to Stripe which in turn will add it
  if (!paymentIntent) {
    return redirectURL.toString()
  }

  /*
   * Same location & query params as the serverside redirect from Stripe if required
   * by the payment method - easing the implementation.
   */
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
