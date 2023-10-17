import {
  IssueFunding,
  Organization,
  Repository,
  SubscriptionGroup,
} from '@polar-sh/sdk'
import { prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import PublicSubscriptionGroups from '../Subscriptions/PublicSubscriptionGroups'
import Footer from './Footer'
import Header from './Header'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const OrganizationPublicPage = ({
  organization,
  repositories,
  issuesFunding,
  totalIssueCount,
  subscriptionGroups,
}: {
  organization: Organization
  repositories: Repository[]
  issuesFunding: IssueFunding[]
  subscriptionGroups: SubscriptionGroup[]
  totalIssueCount: number
}) => {
  const showMeta =
    organization.bio ||
    organization.company ||
    organization.email ||
    organization.twitter_username

  return (
    <>
      <Header organization={organization} repositories={repositories} />

      <h1 className="dark:text-polar-100 text-center text-3xl font-normal text-gray-800 md:text-3xl">
        {organization.name} has {totalIssueCount > 0 ? totalIssueCount : 'no'}{' '}
        {totalIssueCount === 1 ? 'issue' : 'issues'} looking for funding
      </h1>

      {showMeta && (
        <div className="flex flex-col items-center space-y-4">
          {organization.bio && (
            <div className="nowrap dark:text-polar-500 text-center text-gray-500">
              {organization.bio}
            </div>
          )}

          <div className="dark:text-polar-400 mt-2 flex w-full flex-wrap justify-center gap-4 text-sm text-gray-600">
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

      {subscriptionGroups.length > 0 && (
        <PublicSubscriptionGroups
          subscriptionGroups={subscriptionGroups}
          subscribePath="/subscribe"
        />
      )}

      <IssuesLookingForFunding issuesFunding={issuesFunding} />

      <HowItWorks />

      <Footer />
    </>
  )
}

export default OrganizationPublicPage
