import {
  Bolt,
  BusinessOutlined,
  DragIndicatorOutlined,
  EmailOutlined,
  HiveOutlined,
  HowToVoteOutlined,
  LanguageOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import {
  IssueFunding,
  Organization,
  Repository,
  SubscriptionTier,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoType } from 'polarkit/components/brand'
import {
  Avatar,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { twMerge } from 'tailwind-merge'
import { externalURL, prettyURL } from '.'
import HowItWorks from '../Pledge/HowItWorks'
import OrganizationSubscriptionsPublicPage from '../Subscriptions/OrganizationSubscriptionsPublicPage'
import PublicSubscriptionUpsell from '../Subscriptions/PublicSubscriptionUpsell'
import Footer from './Footer'
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
    <Tabs defaultValue="overview">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <a href="/">
          <LogoType />
        </a>
        <TabsList className="dark:border-polar-700 dark:border">
          <TabsTrigger value="overview" size="small">
            <div className="text-[17px]">
              <DragIndicatorOutlined fontSize="inherit" />
            </div>
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="repositories" size="small">
            <div className="text-[17px]">
              <HiveOutlined fontSize="inherit" />
            </div>
            <span>Repositories</span>
          </TabsTrigger>
          <TabsTrigger value="issues" size="small">
            <div className="text-[17px]">
              <HowToVoteOutlined fontSize="inherit" />
            </div>
            <span>Issues</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" size="small">
            <div className="text-[17px]">
              <Bolt fontSize="inherit" />
            </div>
            <span>Subscriptions</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex flex-row gap-x-24 py-16">
        <div className="flex w-64 shrink-0 flex-col gap-y-10">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <Avatar
                className="mb-6 h-60 w-60"
                name={organization.name}
                avatar_url={organization.avatar_url}
              />
              <h1 className="dark:text-polar-50 text-2xl font-normal text-gray-800">
                {organization.pretty_name}
              </h1>
              <h3 className="dark:text-polar-500 text-md font-normal text-gray-600">
                @{organization.name}
              </h3>
            </div>
            {organization.bio && (
              <p className="dark:text-polar-500 text-sm leading-relaxed text-gray-400">
                {organization.bio}
              </p>
            )}
            <div className="dark:text-polar-400 flex flex-col flex-wrap gap-y-6 text-sm text-gray-600">
              <div className="flex flex-col gap-y-2 text-sm">
                {organization.company && (
                  <div className="flex flex-row items-center gap-x-3">
                    <BusinessOutlined fontSize="inherit" />
                    <span>{organization.company}</span>
                  </div>
                )}
                {organization.blog && (
                  <div className="flex flex-row items-center gap-x-3">
                    <LanguageOutlined fontSize="inherit" />
                    <a
                      className="text-blue-600 hover:text-blue-700"
                      href={externalURL(organization.blog)}
                      target="_blank"
                    >
                      {prettyURL(organization.blog)}
                    </a>
                  </div>
                )}

                {organization.email && (
                  <div className="flex flex-row items-center gap-x-3">
                    <EmailOutlined fontSize="inherit" />
                    <a
                      className="text-blue-600 hover:text-blue-700"
                      href={`mailto:${organization.email}`}
                    >
                      {organization.email}
                    </a>
                  </div>
                )}

                {organization.twitter_username && (
                  <div className="flex flex-row items-center gap-x-3">
                    <ShortTextOutlined fontSize="inherit" />
                    <a
                      className="text-blue-600 hover:text-blue-700"
                      href={`https://twitter.com/${organization.twitter_username}`}
                      target="_blank"
                    >
                      @{organization.twitter_username}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-row items-start justify-between">
              <h3>Subscribers</h3>
              <h3>15</h3>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Avatar
                  key={i}
                  className="h-10 w-10"
                  name="Emil Widlund"
                  avatar_url="https://avatars.githubusercontent.com/u/10053249?v=4"
                />
              ))}
              <div className="dark:border-polar-600 dark:text-polar-500 flex h-10 w-10 flex-col items-center justify-center rounded-full border border-blue-200 text-xs font-medium text-blue-400">
                +6
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex flex-row items-start justify-between">
              <h3>Campaigns</h3>
              <h3>3</h3>
            </div>
            <div className="flex flex-col flex-wrap gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={twMerge(
                    'dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-4',
                    i === 0 && 'dark:bg-polar-800 border-blue-100 bg-blue-50',
                  )}
                >
                  <h4 className="text-sm font-medium">Pydantic v{i + 1}</h4>
                  <div
                    style={{
                      display: 'flex',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${80 / (i * 2 + 1)}%`,
                        height: '4px',
                        backgroundColor: '#4667CA', // blue-600

                        transitionProperty: 'all',
                        transitionDuration: '200ms',
                      }}
                    ></div>
                    <div
                      className="dark:bg-polar-700 bg-gray-200"
                      style={{
                        flexGrow: '1',
                        height: '4px',
                      }}
                    ></div>
                  </div>
                  <h4 className="text-xs text-blue-500">View Campaign</h4>
                </div>
              ))}
            </div>
          </div>
        </div>
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
              <Link href={{ pathname: `/${organization.name}/issues` }}>
                <Button size="sm">View all</Button>
              </Link>
            </div>
            <IssuesLookingForFunding organization={organization} />
          </div>
        </TabsContent>
        <TabsContent className="w-full" value="repositories"></TabsContent>
        <TabsContent className="w-full" value="issues">
          <IssuesLookingForFunding organization={organization} />
        </TabsContent>
        <TabsContent className="w-full" value="subscriptions">
          <OrganizationSubscriptionsPublicPage
            organization={organization}
            subscriptionTiers={subscriptionTiers}
          />
        </TabsContent>
      </div>

      <HowItWorks />

      <Footer />
    </Tabs>
  )
}

export default OrganizationPublicPage
