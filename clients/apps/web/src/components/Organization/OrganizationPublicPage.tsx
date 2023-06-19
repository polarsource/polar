import {
  IssuePublicRead,
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const OrganizationPublicPage = ({
  organization,
  repositories,
  issues,
}: {
  organization: OrganizationPublicRead
  repositories: RepositoryPublicRead[]
  issues?: IssuePublicRead[]
}) => {
  return (
    <>
      <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-3xl">
        {organization.name} have{' '}
        {issues && issues?.length > 0 ? issues?.length : 'no'} issues looking
        for funding
      </h1>

      <div>
        <div className="text-center text-gray-500">{organization.bio}</div>

        <div className="mt-2 flex w-full justify-center gap-4 text-sm text-gray-500">
          {organization.company && <div>{organization.company}</div>}

          {organization.blog && (
            <a href={organization.blog}>{organization.blog}</a>
          )}

          {organization.email && <div>{organization.email}</div>}

          {organization.twitter_username && (
            <a href={`https://twitter.com/${organization.twitter_username}`}>
              @{organization.twitter_username}
            </a>
          )}
        </div>
      </div>

      {issues && (
        <IssuesLookingForFunding
          organization={organization}
          repositories={repositories}
          issues={issues}
        />
      )}
    </>
  )
}

export default OrganizationPublicPage
