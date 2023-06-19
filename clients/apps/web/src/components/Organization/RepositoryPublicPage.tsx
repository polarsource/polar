import {
  IssuePublicRead,
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { abbrStars, prettyURL } from '.'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const RepositoryPublicPage = ({
  organization,
  repository,
  issues,
}: {
  organization: OrganizationPublicRead
  repository: RepositoryPublicRead
  issues?: IssuePublicRead[]
}) => {
  return (
    <>
      <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-3xl">
        {organization.name}/{repository.name} have{' '}
        {issues && issues?.length > 0 ? issues?.length : 'no'} issues looking
        for funding
      </h1>

      <div className="flex flex-col items-center space-y-4">
        <p className="text-center text-gray-500">{repository.description}</p>

        <div className="flex items-center space-x-4 text-gray-600">
          {repository.license && <p>{repository.license}</p>}
          {repository.stars && <p>{abbrStars(repository.stars)} stars</p>}
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
    </>
  )
}

export default RepositoryPublicPage
