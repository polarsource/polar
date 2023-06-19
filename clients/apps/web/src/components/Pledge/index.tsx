import {
  IssueRead,
  OrganizationPublicRead,
  RepositoryRead,
} from 'polarkit/api/client'
import { IssueCard, RepositoryCard } from 'polarkit/components/pledge'
import { WhiteCard } from 'polarkit/components/ui/Cards'
import PledgeForm from './PledgeForm'

const Pledge = ({
  organization,
  repository,
  issue,
  asOrg,
  gotoURL,
}: {
  issue: IssueRead
  organization: OrganizationPublicRead
  repository: RepositoryRead
  asOrg?: string
  gotoURL?: string
}) => {
  return (
    <>
      <div className="flex flex-col">
        <WhiteCard
          className="flex flex-col items-stretch rounded-none p-2 text-center md:flex-row md:rounded-xl md:pr-0"
          padding={false}
        >
          <div className="md:w-1/2">
            <IssueCard
              issue={issue}
              className="bg-grid-pattern dark:bg-grid-pattern-dark border-blue-100 bg-blue-50 bg-[12px_12px] dark:border-blue-500/20 dark:bg-blue-500/20"
              organization={organization}
              repository={repository}
            />
          </div>
          <div className="text-left md:w-1/2">
            <div className="py-5 px-3 md:px-6 ">
              <PledgeForm
                organization={organization}
                repository={repository}
                issue={issue}
                asOrg={asOrg}
                gotoURL={gotoURL}
              />
            </div>
          </div>
        </WhiteCard>
      </div>
      <RepositoryCard organization={organization} repository={repository} />
    </>
  )
}

export default Pledge
