import {
  BusinessOutlined,
  EmailOutlined,
  LanguageOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import {
  IssueFunding,
  Organization,
  Repository,
  SubscriptionTier,
} from '@polar-sh/sdk'
import { Avatar } from 'polarkit/components/ui/atoms'
import { externalURL, prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import PublicSubscriptionUpsell from '../Subscriptions/PublicSubscriptionUpsell'
import Footer from './Footer'
import Header from './Header'
import IssuesLookingForFunding from './IssuesLookingForFunding'

const OrganizationPublicPage = ({
  organization,
  repositories,
  issuesFunding,
  totalIssueCount,
  subscriptionTiers,
}: {
  organization: Organization
  repositories: Repository[]
  issuesFunding: IssueFunding[]
  subscriptionTiers: SubscriptionTier[]
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

      <div className="flex flex-col gap-y-8 py-12">
        <Avatar
          className="h-24 w-24 self-center"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />

        <h1 className="dark:text-polar-50 text-center text-3xl font-normal text-gray-800">
          {organization.name}
        </h1>

        {showMeta && (
          <div className="flex flex-col items-center space-y-8">
            {organization.bio && (
              <div className="nowrap dark:text-polar-500 text-center text-gray-500">
                {organization.bio}
              </div>
            )}

            <div className="dark:text-polar-400 mt-2 flex w-full flex-wrap justify-center gap-8 text-sm text-gray-600">
              {organization.company && (
                <div className="flex flex-row items-center gap-x-2">
                  <BusinessOutlined fontSize="small" />
                  <span>{organization.company}</span>
                </div>
              )}

              {organization.blog && (
                <div className="flex flex-row items-center gap-x-2">
                  <LanguageOutlined fontSize="small" />
                  <a
                    className="text-blue-600 hover:text-blue-700"
                    href={externalURL(organization.blog)}
                  >
                    {prettyURL(organization.blog)}
                  </a>
                </div>
              )}

              {organization.email && (
                <div className="flex flex-row items-center gap-x-2">
                  <EmailOutlined fontSize="small" />
                  <span>{organization.email}</span>
                </div>
              )}

              {organization.twitter_username && (
                <div className="flex flex-row items-center gap-x-2">
                  <ShortTextOutlined fontSize="small" />
                  <a
                    className="text-blue-600 hover:text-blue-700"
                    href={`https://twitter.com/${organization.twitter_username}`}
                  >
                    @{organization.twitter_username}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {subscriptionTiers.length > 0 && (
        <PublicSubscriptionUpsell
          organization={organization}
          subscriptionTiers={subscriptionTiers}
          subscribePath="/subscribe"
        />
      )}

      <h1 className="dark:text-polar-100 pb-8 text-center text-2xl font-normal text-gray-800">
        {organization.name} has {totalIssueCount > 0 ? totalIssueCount : 'no'}{' '}
        {totalIssueCount === 1 ? 'issue' : 'issues'} looking for funding
      </h1>

      <IssuesLookingForFunding issuesFunding={issuesFunding} />

      <HowItWorks />

      <Footer />
    </>
  )
}

export default OrganizationPublicPage
