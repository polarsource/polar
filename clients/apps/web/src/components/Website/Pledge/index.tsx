import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { type PledgeRead, type PledgeResources } from 'polarkit/api/client'
import { useState } from 'react'
import DetailsForm from './DetailsForm'
import IssueCard from './IssueCard'
import PaymentForm from './PaymentForm'
import RepositoryCard from './RepositoryCard'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

const Pledge = ({
  organization,
  repository,
  issue,
  query,
}: PledgeResources & {
  query: any // TODO: Investigate & fix type
}) => {
  const [pledge, setPledge] = useState<PledgeRead | null>(null)
  const clientSecret =
    query.payment_intent_client_secret || pledge?.client_secret

  const showPayments = clientSecret

  return (
    <>
      <div className="my-16 flex flex-row space-x-6">
        <div className="flex flex-col">
          <IssueCard issue={issue} />
          <RepositoryCard organization={organization} repository={repository} />
        </div>
        <div className="rounded-xl bg-white px-8 py-14 drop-shadow-lg">
          {!showPayments && (
            <DetailsForm
              organization={organization}
              repository={repository}
              issue={issue}
              setPledge={setPledge}
            />
          )}
          {showPayments && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: clientSecret,
              }}
            >
              <PaymentForm pledge={pledge} query={query} />
            </Elements>
          )}
        </div>
      </div>
    </>
  )
}

export default Pledge
