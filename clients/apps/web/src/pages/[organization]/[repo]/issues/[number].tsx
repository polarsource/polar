import type { NextPage } from 'next'
import { api } from 'lib/api'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useEffect, useState } from 'react'
import {
  useStripe,
  useElements,
  Elements,
  PaymentElement,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

const PaymentStatus = ({ query }) => {
  const stripe = useStripe()
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!stripe) {
      return
    }

    // Retrieve the "payment_intent_client_secret" query parameter appended to
    // your return_url by Stripe.js
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret',
    )

    // Retrieve the PaymentIntent
    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      // Inspect the PaymentIntent `status` to indicate the status of the payment
      // to your customer.
      //
      // Some payment methods will [immediately succeed or fail][0] upon
      // confirmation, while others will first enter a `processing` state.
      //
      // [0]: https://stripe.com/docs/payments/payment-methods#payment-notification
      switch (paymentIntent.status) {
        case 'succeeded':
          setMessage('Success! Payment received.')
          break

        case 'processing':
          setMessage(
            "Payment processing. We'll update you when payment is received.",
          )
          break

        case 'requires_payment_method':
          // Redirect your user back to your payment page to attempt collecting
          // payment again
          setMessage('Payment failed. Please try another payment method.')
          break

        default:
          setMessage('Something went wrong.')
          break
      }
    })
  }, [stripe])

  return message
}

const CheckoutPaymentForm = ({ checkout }) => {
  const stripe = useStripe()
  const elements = useElements()

  const [errorMessage, setErrorMessage] = useState(null)

  const handleSubmit = async (event) => {
    // We don't want to let default form submission happen here,
    // which would refresh the page.
    event.preventDefault()

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return
    }

    const { error } = await stripe.confirmPayment({
      //`Elements` instance that was used to create the Payment Element
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
    })

    if (error) {
      // This point will only be reached if there is an immediate error when
      // confirming the payment. Show error to your customer (for example, payment
      // details incomplete)
      setErrorMessage(error.message)
    } else {
      // Your customer will be redirected to your `return_url`. For some payment
      // methods like iDEAL, your customer will be redirected to an intermediate
      // site first to authorize the payment, then redirected to the `return_url`.
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe}>Submit</button>
      {errorMessage && <div>{errorMessage}</div>}
    </form>
  )
}

const CheckoutDetailsForm = ({ issueId, setCheckout }) => {
  const [amount, setAmount] = useState(10)
  const [currency, setCurrency] = useState('usd')

  const parseAmount = (amount: string) => {
    setAmount(parseInt(amount))
  }

  const createCheckout = async () => {
    const res = await api.post('/api/checkouts', {
      issue_id: issueId,
      amount: amount * 100,
      currency: currency,
    })
    setCheckout(res.data)
  }

  return (
    <>
      <form>
        <input
          type="number"
          placeholder="100"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
          }}
        />
        <p>{currency}</p>
        <button
          type="submit"
          onClick={(e) => {
            e.preventDefault()
            createCheckout()
          }}
        >
          Invest
        </button>
      </form>
    </>
  )
}

const CheckoutForm = ({ issueId, query }) => {
  const [checkout, setCheckout] = useState(null)

  return (
    <>
      {query.payment_intent_client_secret && (
        <Elements stripe={stripePromise}>
          <h3>
            <PaymentStatus query={query} />
          </h3>
        </Elements>
      )}

      <strong>Put some cash behind it</strong>
      {!checkout && (
        <CheckoutDetailsForm issueId={issueId} setCheckout={setCheckout} />
      )}

      {checkout?.client_secret && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: checkout.client_secret,
          }}
        >
          <CheckoutPaymentForm issueId={issueId} checkout={checkout} />
        </Elements>
      )}
    </>
  )
}

const IssuePage: NextPage = ({ data, query }) => {
  const clientSecret = query.payment_intent_client_secret

  return (
    <>
      <h1 className="text-3xl font-bold underline mt-10">{data.title}</h1>
      <p>{data.body}</p>

      <br />
      <CheckoutForm issueId={data.id} query={query} />
    </>
  )
}

export const getServerSideProps = async (context) => {
  const { organization, repo, number } = context.params
  const query = context.query

  const res = await api.get(
    `/api/organizations/${organization}/repos/${repo}/issues/${number}`,
  )
  const data = await res.data

  return { props: { data, query } }
}

export default IssuePage
