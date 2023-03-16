import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useRouter } from 'next/router'
import { useState } from 'react'

interface Payment {
  status: string | null
  success: boolean
  checked: boolean
}

const PaymentForm = ({
  query,
}: {
  query: {
    payment_intent_client_secret: string | undefined
  }
}) => {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [errorMessage, setErrorMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const redirect = (paymentIntent) => {
    /*
     * Same location & query params as the serverside redirect from Stripe if required
     * by the payment method - easing the implementation.
     */
    const location = new URL(window.location.href + '/status')
    location.searchParams.append('payment_intent_id', paymentIntent.id)
    location.searchParams.append(
      'payment_intent_client_secret',
      paymentIntent.client_secret,
    )
    location.searchParams.append('redirect_status', paymentIntent.status)
    router.replace(location.toString())
  }

  const handlePayment = (paymentIntent) => {
    switch (paymentIntent.status) {
      case 'succeeded':
      case 'processing':
        redirect(paymentIntent)
        break

      case 'requires_payment_method':
        setErrorMessage('Payment failed. Please try another payment method.')
        break

      default:
        setErrorMessage('Something went wrong.')
        break
    }
  }

  const onSubmit = (event) => {
    event.preventDefault()

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return
    }

    setLoading(true)
    stripe
      .confirmPayment({
        //`Elements` instance that was used to create the Payment Element
        elements,
        confirmParams: {
          return_url: window.location.href + '/status',
        },
        redirect: 'if_required',
      })
      .then(({ paymentIntent }) => {
        setLoading(false)
        handlePayment(paymentIntent)
      })
      .catch((error) => {
        setErrorMessage(error.message)
      })
  }

  return (
    <form onSubmit={onSubmit}>
      <PaymentElement />
      {loading && <div>Loading...</div>}
      {!loading && <button disabled={!stripe}>Submit</button>}
      <br />

      {errorMessage && <div>{errorMessage}</div>}
    </form>
  )
}
export default PaymentForm
