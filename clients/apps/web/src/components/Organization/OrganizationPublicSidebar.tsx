'use client'

import { useAuth } from '@/hooks/auth'
import { RssIcon } from '@heroicons/react/20/solid'
import { LanguageOutlined, MailOutline } from '@mui/icons-material'
import {
  CreatePersonalAccessTokenResponse,
  ListResourceSubscriptionSummary,
  Organization,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { api } from 'polarkit'
import {
  Avatar,
  Button,
  CopyToClipboardInput,
} from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations, useSubscriptionTiers } from 'polarkit/hooks'
import {
  Fragment,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import { externalURL } from '.'
import GitHubIcon from '../Icons/GitHubIcon'
import { Modal, ModalHeader } from '../Modal'
import { useModal } from '../Modal/useModal'
import Spinner from '../Shared/Spinner'
import { FreeTierSubscribe } from './FreeTierSubscribe'

interface OrganizationPublicSidebarProps {
  organization: Organization
  subscriptionsSummary: ListResourceSubscriptionSummary
}

export const OrganizationPublicSidebar = ({
  organization,
  subscriptionsSummary,
}: OrganizationPublicSidebarProps) => {
  const pathname = usePathname()
  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const {
    isShown: rssModalIsShown,
    hide: hideRssModal,
    show: showRssModal,
  } = useModal()

  const subscribers = useMemo(
    () => (subscriptionsSummary.items ?? []).slice(0, 9),
    [subscriptionsSummary],
  )

  const subscribersCount = subscriptionsSummary.pagination.total_count

  const subscribersHiddenCount = useMemo(
    () => subscribersCount - subscribers.length,
    [subscribers, subscribersCount],
  )

  const freeSubscriptionTier = useMemo(
    () =>
      subscriptionTiers?.find(
        (tier) => tier.type === SubscriptionTierType.FREE,
      ),
    [subscriptionTiers],
  )

  const adminOrgs = useListAdminOrganizations()
  const shouldRenderDashboardButton = useMemo(
    () =>
      adminOrgs?.data?.items?.some((org) => org.name === organization?.name),
    [adminOrgs, organization],
  )

  const isPostView = pathname.includes('/posts/')

  return (
    <div className="flex h-fit w-full shrink-0 flex-col gap-y-10 md:sticky md:top-32 md:w-64">
      <>
        <div className="flex flex-col items-start gap-y-6">
          <div className="flex w-full flex-row items-center gap-x-2 gap-y-2 md:flex-col md:items-start md:gap-x-0">
            <Avatar
              className="h-16 w-16 md:mb-6 md:h-32 md:w-32"
              name={organization.name}
              avatar_url={organization.avatar_url}
              height={240}
              width={240}
            />
            <div className="flex flex-col items-start md:gap-y-2">
              <h1 className="dark:text-polar-50 text-xl font-normal text-gray-800 md:text-2xl">
                {organization.pretty_name ?? organization.name}
              </h1>
              <Link
                href={`/${organization.name}`}
                className="text-md font-normal text-blue-500 dark:text-blue-400"
              >
                @{organization.name}
              </Link>
            </div>
          </div>
          <div
            className={twMerge(
              'w-full flex-col items-start gap-y-6',
              isPostView ? 'hidden  md:flex' : 'flex',
            )}
          >
            <div className="flex flex-col gap-y-6">
              {organization.bio ? (
                <p className="dark:text-polar-500 text-start text-sm leading-relaxed text-gray-500">
                  {organization.bio}
                </p>
              ) : null}
              <div className="flex flex-row items-center gap-x-2">
                <SocialLink href={`https://github.com/${organization.name}`}>
                  <GitHubIcon width={15} height={15} />
                </SocialLink>
                <SocialLink
                  href={`https://twitter.com/${organization.twitter_username}`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 300 300.251"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"
                      fill="currentColor"
                    />
                  </svg>
                </SocialLink>
                {organization.blog && (
                  <SocialLink href={externalURL(organization.blog)}>
                    <LanguageOutlined fontSize="inherit" />
                  </SocialLink>
                )}
                <SocialLink href={`mailto:${organization.email}`}>
                  <MailOutline fontSize="inherit" />
                </SocialLink>
                <Button
                  className="dark:bg-polar-700 dark:hover:bg-polar-600 dark:text-polar-200 flex h-8 w-8 flex-col items-center justify-center rounded-full border-none bg-blue-50 text-blue-500 transition-colors hover:bg-blue-100"
                  onClick={showRssModal}
                >
                  <RssIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {shouldRenderDashboardButton ? (
              <Link
                className="w-full"
                href={`/maintainer/${organization.name}/overview`}
              >
                <Button fullWidth>View Dashboard</Button>
              </Link>
            ) : freeSubscriptionTier ? (
              <FreeTierSubscribe
                subscriptionTier={freeSubscriptionTier}
                organization={organization}
              />
            ) : null}
          </div>
          {subscribers.length > 0 && (
            <div
              className={twMerge(
                'flex w-full flex-col gap-y-4',
                isPostView ? 'hidden  md:flex' : 'flex',
              )}
            >
              <div className="flex flex-row items-start justify-between">
                <h3 className="dark:text-polar-50 text-gray-950">
                  Subscribers
                </h3>
                <h3 className="dark:text-polar-500 text-sm text-gray-500">
                  {subscribersCount}
                </h3>
              </div>
              <div className="flex flex-row flex-wrap gap-3">
                {subscribers.map(({ user, organization }, idx) => (
                  <Fragment key={idx}>
                    {organization && (
                      <Link
                        key={organization.name}
                        href={`https://github.com/${organization.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Avatar
                          className="h-10 w-10"
                          name={organization.name}
                          avatar_url={organization.avatar_url}
                        />
                      </Link>
                    )}
                    {!organization && (
                      <>
                        {user.github_username ? (
                          <Link
                            key={user.github_username}
                            href={`https://github.com/${user.github_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Avatar
                              className="h-10 w-10"
                              name={user.github_username}
                              avatar_url={user.avatar_url}
                            />
                          </Link>
                        ) : (
                          <Avatar
                            className="h-10 w-10"
                            name={user.public_name}
                            avatar_url={user.avatar_url}
                          />
                        )}
                      </>
                    )}
                  </Fragment>
                ))}
                {subscribersHiddenCount > 0 && (
                  <div className="dark:border-polar-700 dark:bg-polar-900 dark:text-polar-400 flex h-10 w-10 flex-col items-center justify-center rounded-full bg-blue-50 text-xs font-medium text-blue-400 dark:border-2">
                    +{subscribersHiddenCount}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </>
      <Modal
        isShown={rssModalIsShown}
        hide={hideRssModal}
        modalContent={
          <RssModal hide={hideRssModal} organization={organization} />
        }
      />
    </div>
  )
}

const SocialLink = (props: PropsWithChildren<{ href?: string }>) => {
  if (!props.href) return null

  return (
    <Link
      target="_blank"
      rel="noopener nofollow"
      className="dark:bg-polar-700 dark:hover:bg-polar-600 dark:text-polar-200 flex h-8 w-8 flex-col items-center justify-center rounded-full bg-blue-50 text-blue-500 transition-colors hover:bg-blue-100"
      href={props.href}
    >
      {props.children}
    </Link>
  )
}

const RssModal = ({
  hide,
  organization,
}: {
  hide: () => void
  organization: Organization
}) => {
  const { currentUser } = useAuth()
  const [token, setToken] = useState<string>()
  const auth = token ? `?auth=${token}` : ''
  const url = `https://polar.sh/${organization.name}/rss${auth}`

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let active = true

    api.personalAccessToken
      .create({
        createPersonalAccessToken: {
          comment: `RSS for ${organization.name}`,
          scopes: ['articles:read'],
        },
      })
      .then((res: CreatePersonalAccessTokenResponse) => {
        if (active) {
          setToken(res.token)
        }
      })

    return () => {
      active = false
    }
  }, [currentUser])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          Subscribe to {organization.pretty_name || organization.name} via RSS
        </h3>
      </ModalHeader>
      <div className="p-8">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <span className="font-medium">
              {currentUser ? 'Your feed URL' : 'Feed URL'}
            </span>
            {currentUser ? (
              <p className="text-polar-500 dark:text-polar-500 text-sm">
                This URL is personal, keep it safe.
              </p>
            ) : null}
          </div>

          {url ? (
            <div className="flex items-center gap-2">
              <CopyToClipboardInput value={url} id={'rssurl'} />
              <Link href={`feed:${url}`}>
                <Button asChild>Open</Button>
              </Link>
            </div>
          ) : (
            <Spinner />
          )}
        </div>
      </div>
    </>
  )
}
