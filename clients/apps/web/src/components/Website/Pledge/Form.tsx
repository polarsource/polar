import { Elements } from '@stripe/react-stripe-js'
import { type IssuePledge, type PledgeRead } from 'polarkit/api/client'
import { useState } from 'react'
import DetailsForm from './DetailsForm'
import PaymentForm from './PaymentForm'

const Form = ({
  organization,
  repository,
  issue,
  query,
  stripePromise,
}: IssuePledge & {
  query: any // TODO: Investigate type
  stripePromise: any // TODO: Investigate type
}) => {
  const [pledge, setPledge] = useState<PledgeRead | null>(null)

  return (
    <>
      <div className="rounded-xl bg-white px-8 py-14 drop-shadow-lg">
        {!pledge && (
          <DetailsForm
            organization={organization}
            repository={repository}
            issue={issue}
            setPledge={setPledge}
          />
        )}
        {pledge?.client_secret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: pledge.client_secret,
            }}
          >
            <PaymentForm
              organization={organization}
              repository={repository}
              issue={issue}
              pledge={pledge}
            />
          </Elements>
        )}
      </div>
    </>
  )
}

export default Form
