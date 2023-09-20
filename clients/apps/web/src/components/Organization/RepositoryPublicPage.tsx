import { Issue, Organization, Repository } from 'polarkit/api/client'
import { formatStarsNumber } from 'polarkit/utils'
import { prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import Footer from './Footer'
import Header from './Header'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const RepositoryPublicPage = ({
  organization,
  repository,
  repositories,
  issues,
  totalIssueCount,
}: {
  organization: Organization
  repository: Repository
  repositories: Repository[]
  issues?: Issue[]
  totalIssueCount: number
}) => {
  return (
    <>
      <Header
        organization={organization}
        repositories={repositories}
        repository={repository}
      />

      <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-3xl">
        {organization.name}/{repository.name} has{' '}
        {totalIssueCount > 0 ? totalIssueCount : 'no'}{' '}
        {totalIssueCount === 1 ? 'issue' : 'issues'} looking for funding
      </h1>

      <div className="flex flex-col items-center space-y-4">
        {repository.description && (
          <p className="text-center text-gray-500">{repository.description}</p>
        )}

        <div className="flex flex-wrap items-center space-x-4 text-gray-600">
          {repository.license && <p>{repository.license}</p>}

          <p>{formatStarsNumber(repository.stars || 0)} stars</p>

          {repository.homepage && (
            <a
              className="text-blue-600 hover:text-blue-700"
              href={repository.homepage}
            >
              {prettyURL(repository.homepage)}
            </a>
          )}
        </div>
      </div>

      {issues && (
        <IssuesLookingForFunding
          organization={organization}
          repositories={[repository]}
          issues={issues}
        />
      )}

      <HowItWorks />

      <Footer />
    </>
  )
}

export default RepositoryPublicPage
