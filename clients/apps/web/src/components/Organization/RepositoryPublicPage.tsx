import {
  IssuePublicRead,
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { abbrStars, prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const RepositoryPublicPage = ({
  organization,
  repository,
  issues,
  totalIssueCount,
}: {
  organization: OrganizationPublicRead
  repository: RepositoryPublicRead
  issues?: IssuePublicRead[]

  totalIssueCount: number
}) => {
  return (
    <>
      <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-3xl">
        {organization.name}/{repository.name} have{' '}
        {totalIssueCount > 0 ? totalIssueCount : 'no'}{' '}
        {totalIssueCount === 1 ? 'issue' : 'issues'} looking for funding
      </h1>

      <div className="flex flex-col items-center space-y-4">
        {repository.description && (
          <p className="text-center text-gray-500">{repository.description}</p>
        )}

        <div className="flex flex-wrap items-center space-x-4 text-gray-600">
          {repository.license && <p>{repository.license}</p>}
          {(repository.stars && repository.stars > 0 && (
            <p>{abbrStars(repository.stars)} stars</p>
          )) ||
            null}
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

      <div className="flex items-center justify-center gap-6">
        <a className="text-blue-600 hover:text-blue-500" href="/faq">
          Polar FAQ
        </a>
        <span className="text-gray-500">&copy; Polar Software Inc 2023</span>
      </div>
    </>
  )
}

export default RepositoryPublicPage
