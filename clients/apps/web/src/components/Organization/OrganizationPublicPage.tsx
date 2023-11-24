import {
  Article,
  Organization,
  Repository,
  SubscriptionSummary,
  SubscriptionTier,
} from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import { Tabs } from 'polarkit/components/ui/atoms'
import HowItWorks from '../Pledge/HowItWorks'
import Footer from './Footer'
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
    <Tabs
      className="flex min-h-screen flex-col justify-between"
      defaultValue={onFirstRenderTab ?? 'overview'}
    >
      <div className="flex flex-col">
        <div className="flex w-full flex-col items-center justify-between gap-6 px-4 md:flex-row md:justify-normal md:gap-24 md:px-0">
          <div className="shrink-0 md:w-64">
            <a href="/">
              <LogoType />
            </a>
          </div>
          <OrganizationPublicPageNav
            shouldRenderSubscriptionsTab={subscriptionTiers.length > 0}
          />
        </div>

        <div className="relative flex flex-col gap-x-24 px-4 py-16 md:flex-row md:px-0">
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
      <div>
        <HowItWorks />
        <Footer />
      </div>
    </Tabs>
  )
}

export default OrganizationPublicPage
