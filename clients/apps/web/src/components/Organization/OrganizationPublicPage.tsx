import {
  IssuePublicRead,
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const OrganizationPublicPage = ({
  organization,
  repositories,
  issues,
  totalIssueCount,
}: {
  organization: OrganizationPublicRead
  repositories: RepositoryPublicRead[]
  issues?: IssuePublicRead[]
  totalIssueCount: number
}) => {
  const showMeta =
    organization.bio ||
    organization.company ||
    organization.email ||
    organization.twitter_username

  return (
    <>
      <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-3xl">
        {organization.name} have {totalIssueCount > 0 ? totalIssueCount : 'no'}{' '}
        {totalIssueCount === 1 ? 'issue' : 'issues'} looking for funding
      </h1>

      {showMeta && (
        <div className="flex flex-col items-center space-y-4">
          {organization.bio && (
            <div className="text-center text-gray-500">{organization.bio}</div>
          )}

          <div className="mt-2 flex w-full justify-center gap-4 text-sm text-gray-600">
            {organization.company && <div>{organization.company}</div>}

            {organization.blog && (
              <a
                className="text-blue-600 hover:text-blue-700"
                href={organization.blog}
              >
                {prettyURL(organization.blog)}
              </a>
            )}

            {organization.email && <div>{organization.email}</div>}

            {organization.twitter_username && (
              <a
                className="text-blue-600 hover:text-blue-700"
                href={`https://twitter.com/${organization.twitter_username}`}
              >
                @{organization.twitter_username}
              </a>
            )}
          </div>
        </div>
      )}

      {issues && (
        <IssuesLookingForFunding
          organization={organization}
          repositories={repositories}
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

export default OrganizationPublicPage
