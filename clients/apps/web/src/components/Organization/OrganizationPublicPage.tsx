import {
  Article,
  Organization,
  Repository,
  SubscriptionSummary,
  SubscriptionTier,
} from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import { Tabs } from 'polarkit/components/ui/atoms'
import {
  OrganizationPublicPageContent,
  OrganizationPublicPageNav,
} from './OrganizationPublicPageNav'
import { OrganizationPublicSidebar } from './OrganizationPublicSidebar'

const OrganizationPublicPage = ({
  posts,
  organization,
  repositories,
  subscriptionTiers,
  subscriptionSummary,
  subscribersCount,
  onFirstRenderTab,
}: {
  posts: Article[]
  organization: Organization
  repositories: Repository[]
  subscriptionTiers: SubscriptionTier[]
  subscriptionSummary: SubscriptionSummary[]
  subscribersCount: number
  onFirstRenderTab?: string
}) => {
  return (
    <>
      <Tabs
        className="flex min-h-screen flex-col justify-between"
        defaultValue={onFirstRenderTab ?? 'overview'}
      >
        <div className="flex flex-col px-8">
          <div className="relative flex w-full flex-row items-center justify-between gap-x-24 md:justify-normal">
            <div className="shrink-0 md:w-64">
              <a href="/">
                <LogoType />
              </a>
            </div>
            <OrganizationPublicPageNav
              shouldRenderSubscriptionsTab={subscriptionTiers.length > 0}
            />
          </div>

          <div className="relative flex w-full flex-col gap-x-24 py-16 md:flex-row">
            <OrganizationPublicSidebar
              organization={organization}
              subscribersCount={subscribersCount}
              subscriptionSummary={subscriptionSummary}
            />
            <OrganizationPublicPageContent
              organization={organization}
              posts={posts}
              repositories={repositories}
              subscriptionTiers={subscriptionTiers}
            />
          </div>
        </div>
      </Tabs>
    </>
  )
}

export default OrganizationPublicPage
