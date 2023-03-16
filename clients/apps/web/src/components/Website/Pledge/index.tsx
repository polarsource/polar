import { loadStripe } from '@stripe/stripe-js/pure'
import { type IssuePledge } from 'polarkit/api/client'
import Form from './Form'
import IssueCard from './IssueCard'
import RepositoryCard from './RepositoryCard'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY)

const Pledge = ({
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
        <Form
          organization={organization}
          repository={repository}
          issue={issue}
          stripePromise={stripePromise}
          query={query}
        />
      </div>
    </>
  )
}

export default Pledge
