import {
  BusinessOutlined,
  EmailOutlined,
  LanguageOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import {
  Organization,
  Repository,
  SubscriptionSummary,
  SubscriptionTier,
} from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import { Avatar, Tabs, TabsContent } from 'polarkit/components/ui/atoms'
import { useMemo } from 'react'
import { externalURL, prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import OrganizationSubscriptionsPublicPage from '../Subscriptions/OrganizationSubscriptionsPublicPage'
import PublicSubscriptionUpsell from '../Subscriptions/PublicSubscriptionUpsell'
import CampaignsSummary from './CampaignsSummary'
import Footer from './Footer'
import IssuesLookingForFunding from './IssuesLookingForFunding'
import { OrganizationPublicPageNav } from './OrganizationPublicPageNav'
import { RepositoriesOverivew } from './RepositoriesOverview'

const OrganizationPublicPage = ({
  organization,
  repositories,
  subscriptionTiers,
  subscriptionSummary,
  subscribersCount,
  currentTab,
}: {
  organization: Organization
  repositories: Repository[]
  subscriptionTiers: SubscriptionTier[]
  subscriptionSummary: SubscriptionSummary[]
  subscribersCount: number
  currentTab?: string
}) => {
  const showMeta =
    organization.bio ||
    organization.company ||
    organization.email ||
    organization.twitter_username

  const subscriberUsers = useMemo(
    () => subscriptionSummary.slice(0, 9).map((summary) => summary.user),
    [subscriptionSummary],
  )

  const subscribersHiddenCount = useMemo(
    () => subscriptionSummary.slice(9).length,
    [subscriptionSummary],
  )

  return (
    <Tabs
      className="flex min-h-screen flex-col justify-between"
      defaultValue={currentTab ?? 'overview'}
    >
      <div className="flex flex-col">
        <div className="flex w-full flex-col items-center justify-between gap-6 px-4 md:flex-row md:justify-normal md:gap-24 md:px-0">
          <div className="shrink-0 md:w-64">
            <a href="/">
              <LogoType />
            </a>
          </div>
          <OrganizationPublicPageNav />
        </div>

        <div className="relative flex flex-col gap-x-24 px-4 py-16 md:flex-row md:px-0">
          <div className="flex h-full w-full shrink-0 flex-col gap-y-10 md:w-64">
            <div className="flex flex-col items-center gap-y-6 md:items-start">
              <div className="flex flex-col items-center gap-y-2 md:items-start">
                <Avatar
                  className="mb-6 h-32 w-32 md:h-60 md:w-60"
                  name={organization.name}
                  avatar_url={organization.avatar_url}
                />
                <h1 className="dark:text-polar-50 text-2xl font-normal capitalize text-gray-800">
                  {organization.pretty_name ?? organization.name}
                </h1>
                <h3 className="dark:text-polar-500 text-md font-normal text-gray-600">
                  @{organization.name}
                </h3>
              </div>
              {organization.bio && (
                <p className="dark:text-polar-500 text-center text-sm leading-relaxed text-gray-400 md:text-start">
                  {organization.bio}
                </p>
              )}
              {showMeta && (
                <div className="dark:text-polar-500 flex flex-col gap-y-2 text-sm">
                  {organization.company && (
                    <div className="flex flex-row items-center gap-x-3">
                      <span className="text-[17px]">
                        <BusinessOutlined fontSize="inherit" />
                      </span>
                      <span>{organization.company}</span>
                    </div>
                  )}
                  {organization.blog && (
                    <div className="flex flex-row items-center gap-x-3">
                      <span className="text-[17px]">
                        <LanguageOutlined fontSize="inherit" />
                      </span>
                      <a
                        className="text-blue-600 hover:text-blue-700"
                        href={externalURL(organization.blog)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {prettyURL(organization.blog)}
                      </a>
                    </div>
                  )}

                  {organization.email && (
                    <div className="flex flex-row items-center gap-x-3">
                      <span className="text-[17px]">
                        <EmailOutlined fontSize="inherit" />
                      </span>
                      <a
                        className="text-blue-600 hover:text-blue-700"
                        href={`mailto:${organization.email}`}
                        rel="noopener noreferrer"
                      >
                        {organization.email}
                      </a>
                    </div>
                  )}

                  {organization.twitter_username && (
                    <div className="flex flex-row items-center gap-x-3">
                      <span className="text-[17px]">
                        <ShortTextOutlined fontSize="inherit" />
                      </span>
                      <a
                        className="text-blue-600 hover:text-blue-700"
                        href={`https://twitter.com/${organization.twitter_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{organization.twitter_username}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            {subscriberUsers.length > 0 && (
              <div className="flex flex-col gap-y-4">
                <div className="flex flex-row items-start justify-between">
                  <h3>Subscribers</h3>
                  <h3>{subscribersCount}</h3>
                </div>
                <div className="flex flex-row flex-wrap gap-3">
                  {subscriberUsers.map((user) => (
                    <Avatar
                      key={user.username}
                      className="h-10 w-10"
                      name={user.username}
                      avatar_url={user.avatar_url}
                    />
                  ))}
                  {subscribersHiddenCount > 0 && (
                    <div className="dark:border-polar-600 dark:text-polar-500 flex h-10 w-10 flex-col items-center justify-center rounded-full border border-blue-200 text-xs font-medium text-blue-400">
                      {subscribersHiddenCount}
                    </div>
                  )}
                </div>
              </div>
            )}
            <CampaignsSummary />
          </div>
          <div className="mt-12 flex h-full w-full flex-col md:mt-0">
            <TabsContent className="w-full" value="overview">
              <div className="flex w-full flex-col gap-y-8">
                {subscriptionTiers.length > 0 && (
                  <PublicSubscriptionUpsell
                    organization={organization}
                    subscriptionTiers={subscriptionTiers}
                    subscribePath="/subscribe"
                  />
                )}

                <div className="flex flex-row items-start justify-between">
                  <h2 className="text-lg">Issues looking for funding</h2>
                </div>
                <IssuesLookingForFunding organization={organization} />
              </div>
            </TabsContent>
            <TabsContent className="w-full" value="repositories">
              <RepositoriesOverivew
                organization={organization}
                repositories={repositories}
              />
            </TabsContent>
            <TabsContent className="w-full" value="subscriptions">
              <OrganizationSubscriptionsPublicPage
                organization={organization}
                subscriptionTiers={subscriptionTiers}
              />
            </TabsContent>
          </div>
        </div>
      </div>
      <div>
        <HowItWorks />
        <Footer />
      </div>
    </Tabs>
  )
}

export default OrganizationPublicPage
