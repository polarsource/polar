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
      <div className="my-14 flex flex-col">
        <div className="flex flex-row rounded-xl bg-white p-2 text-center drop-shadow-lg">
          <div className="w-1/2">
            <IssueCard issue={issue} />
          </div>
          <div className="w-1/2 text-left">
            <div className="py-5 px-6">
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
        </div>
        <RepositoryCard organization={organization} repository={repository} />
      </div>
    </>
  )
}

export default Pledge
