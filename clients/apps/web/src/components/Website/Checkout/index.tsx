import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import IssueCard from 'components/Website/Checkout/IssueCard'
import RepositoryCard from 'components/Website/Checkout/RepositoryCard'
import { api } from 'polarkit'
import { type IssuePledge, type RewardRead } from 'polarkit/api/client'
import { useEffect, useState } from 'react'

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

const CheckoutPaymentForm = ({
  organization,
  repository,
  issue,
  checkout,
}: IssuePledge & {
  checkout: RewardRead
}) => {
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

const CheckoutDetailsForm = ({
  organization,
  repository,
  issue,
  setCheckout,
}: IssuePledge & {
  setCheckout: (checkout: RewardRead) => void
}) => {
  const [amount, _setAmount] = useState(0)
  const [currency, setCurrency] = useState('usd')

  const setAmount = (amount: string) => {
    _setAmount(parseInt(amount))
  }

  const createCheckout = async () => {
    const checkout = await api.rewards.createReward({
      platform: organization.platform,
      orgName: organization.name,
      repoName: repository.name,
      requestBody: {
        issue_id: issue.id,
        amount: amount,
      },
    })
    console.log(checkout)
    setCheckout(checkout)
  }

  return (
    <>
      <form className="flex flex-col">
        <label htmlFor="amount">Choose amount to pledge</label>
        <div className="flex flex-row items-center space-x-4">
          <input
            type="number"
            id="amount"
            placeholder="50"
            min="50"
            onChange={(e) => {
              setAmount(e.target.value)
            }}
          />
          <p>Minimum is $50</p>
        </div>

        <label htmlFor="email">Contact details</label>
        <input type="email" id="email" />

        <button
          type="submit"
          onClick={(e) => {
            e.preventDefault()
            createCheckout()
          }}
        >
          Submit
        </button>
      </form>
    </>
  )
}

const CheckoutForm = ({
  organization,
  repository,
  issue,
  query,
}: IssuePledge & {
  query: any
}) => {
  const [checkout, setCheckout] = useState<RewardRead | null>(null)

  return (
    <>
      <div className="rounded-xl bg-white px-8 py-14 drop-shadow-lg">
        {!checkout && (
          <CheckoutDetailsForm
            organization={organization}
            repository={repository}
            issue={issue}
            setCheckout={setCheckout}
          />
        )}
        {checkout?.client_secret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: checkout.client_secret,
            }}
          >
            <CheckoutPaymentForm
              organization={organization}
              repository={repository}
              issue={issue}
              checkout={checkout}
            />
          </Elements>
        )}
      </div>
    </>
  )
}

/*
 * To discuss with Magnus:
 * - From decimal to int (cents)?  Consistent with Stripe
 * - Rename rewards to checkout?
 * - Create a user account
 */

const Checkout = ({
  organization,
  repository,
  issue,
  query,
}: IssuePledge & {
  query: any // TODO: Investigate & fix type
}) => {
  return (
    <>
      <div className="my-16 flex flex-row space-x-6">
        <div className="flex flex-col">
          <IssueCard issue={issue} />
          <RepositoryCard organization={organization} repository={repository} />
        </div>
        <CheckoutForm
          organization={organization}
          repository={repository}
          issue={issue}
          query={query}
        />
      </div>
    </>
  )
}

export default Checkout
