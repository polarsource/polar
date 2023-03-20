import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { type PledgeRead, type PledgeResources } from 'polarkit/api/client'
import PrimaryButton from 'polarkit/components/ui/PrimaryButton'
import { useState } from 'react'
import DetailsForm from './DetailsForm'
import PaymentForm from './PaymentForm'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

const PledgeForm = ({
  organization,
  repository,
  issue,
  query,
}: PledgeResources & {
  query: any // TODO: Investigate & fix type
}) => {
  const [pledge, setPledge] = useState<PledgeRead | null>(null)

  return (
    <>
      <form className="flex flex-col">
        <DetailsForm
          organization={organization}
          repository={repository}
          issue={issue}
          pledge={pledge}
          setPledge={setPledge}
        />
        {pledge && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: pledge.client_secret,
            }}
          >
            <PaymentForm pledge={pledge} />
          </Elements>
        )}

        {/*
         * Unfortunately, we need to have this button (disabled) by default and then
         * remove it once Stripe is initiated. Since we cannot (in an easy/nice way)
         * manage the submission outside of the Stripe Elements context.
         */}
        {!pledge && (
          <div className="mt-6">
            <PrimaryButton disabled={true}>Pledge $0</PrimaryButton>
          </div>
        )}
      </form>
    </>
  )
}
export default PledgeForm
