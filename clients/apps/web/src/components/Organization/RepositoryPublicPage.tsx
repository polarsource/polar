import { IssueFunding, Organization, Repository } from '@polar-sh/sdk'
import { formatStarsNumber } from 'polarkit/utils'
import { externalURL, prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import Header from './Header'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const RepositoryPublicPage = ({
  organization,
  repository,
  repositories,
  issuesFunding,
  totalIssueCount,
}: {
  organization: Organization
  repository: Repository
  repositories: Repository[]
  issuesFunding: IssueFunding[]
  totalIssueCount: number
}) => {
  return (
    <>
      <Header
        organization={organization}
        repositories={repositories}
        repository={repository}
      />

      <h1 className="dark:text-polar-100 text-center text-3xl font-normal text-gray-800 md:text-3xl">
        {organization.name}/{repository.name} has{' '}
        {totalIssueCount > 0 ? totalIssueCount : 'no'}{' '}
        {totalIssueCount === 1 ? 'issue' : 'issues'} looking for funding
      </h1>

      <div className="flex flex-col items-center space-y-4">
        {repository.description && (
          <p className="dark:text-polar-500 text-center  text-gray-500">
            {repository.description}
          </p>
        )}

        <div className="dark:text-polar-400 flex flex-wrap items-center space-x-4 text-gray-600">
          {repository.license && <p>{repository.license}</p>}

          <p>{formatStarsNumber(repository.stars || 0)} stars</p>

          {repository.homepage && (
            <a
              className="text-blue-500 hover:text-blue-700"
              href={externalURL(repository.homepage)}
            >
              {prettyURL(repository.homepage)}
            </a>
          )}
        </div>
      </div>

      <IssuesLookingForFunding
        organization={organization}
        repository={repository}
      />

      <HowItWorks />
    </>
  )
}

export default RepositoryPublicPage
