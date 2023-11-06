import {
  BusinessOutlined,
  EmailOutlined,
  LanguageOutlined,
  SearchOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import {
  IssueFunding,
  Organization,
  Repository,
  SubscriptionTier,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar, Button, Input } from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { twMerge } from 'tailwind-merge'
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

      <div className="flex flex-row items-center gap-x-8 py-4">
        <Avatar
          className="h-32 w-32"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />

        <div className="flex flex-col items-start gap-y-4">
          <h1 className="dark:text-polar-50 text-3xl font-normal text-gray-800">
            {organization.name}
          </h1>

          {showMeta && (
            <div className="flex w-full flex-col space-y-4">
              {organization.bio && (
                <div className="dark:text-polar-500 text-gray-500">
                  {organization.bio}
                </div>
              )}

              <div className="dark:text-polar-400 flex w-full flex-wrap justify-center gap-8 text-sm text-gray-600">
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
      </div>

      <Separator />

      <div className="flex flex-row gap-x-20 pt-4">
        <div className="flex w-80 flex-col gap-y-10">
          <div>
            <p className="dark:text-polar-500 text-sm leading-relaxed text-gray-400">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
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
                  className="h-9 w-9"
                  name="Emil Widlund"
                  avatar_url="https://avatars.githubusercontent.com/u/10053249?v=4"
                />
              ))}
              <div className="dark:border-polar-600 dark:text-polar-500 flex h-9 w-9 flex-col items-center justify-center rounded-full border border-blue-200 text-sm font-medium text-blue-400">
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
              <Button variant="secondary" size="sm">
                View all
              </Button>
            </Link>
          </div>

          <div>
            <Input
              preSlot={
                <SearchOutlined className="h-5 w-5" fontSize="inherit" />
              }
              placeholder="Search Filter"
            />
          </div>

          <div className="-mx-6">
            <IssuesLookingForFunding issuesFunding={issuesFunding} />
          </div>
        </div>
      </div>

      <HowItWorks />

      <Footer />
    </>
  )
}

export default OrganizationPublicPage
