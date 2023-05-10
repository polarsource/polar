import { type PledgeResources } from 'polarkit/api/client'
import { IssueCard, RepositoryCard } from 'polarkit/components/pledge'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import PledgeForm from './PledgeForm'

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
        <WhiteCard
          className="flex flex-col items-stretch p-2 text-center md:flex-row"
          padding={false}
        >
          <div className="md:w-1/2">
            <IssueCard
              issue={issue}
              className="bg-blue-50"
              organization={organization}
              repository={repository}
            />
          </div>
          <div className="text-left md:w-1/2">
            <div className="py-5 px-6">
              <PledgeForm
                organization={organization}
                repository={repository}
                issue={issue}
                query={query}
              />
            </div>
          </div>
        </WhiteCard>
        <RepositoryCard organization={organization} repository={repository} />
      </div>
    </>
  )
}

export default Pledge
