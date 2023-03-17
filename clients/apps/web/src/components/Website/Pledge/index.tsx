import { type PledgeResources } from 'polarkit/api/client'
import IssueCard from './IssueCard'
import PledgeForm from './PledgeForm'
import RepositoryCard from './RepositoryCard'

const Pledge = ({
  organization,
  repository,
  issue,
  query,
}: PledgeResources & {
  query: any // TODO: Investigate & fix type
}) => {
  return (
    <>
      <div className="my-14 flex flex-col">
        <div className="flex flex-row rounded-xl bg-white p-2 text-center drop-shadow-lg">
          <div className="w-1/2">
            <IssueCard issue={issue} />
          </div>
          <div className="w-1/2 text-left">
            <div className="py-5 px-6">
              <PledgeForm
                organization={organization}
                repository={repository}
                issue={issue}
                query={query}
              />
            </div>
          </div>
        </div>
        <RepositoryCard organization={organization} repository={repository} />
      </div>
    </>
  )
}

export default Pledge
