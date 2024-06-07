'use client'

import revalidate from '@/app/actions'
import { useAuth } from '@/hooks'
import { useUpdateOrganization } from '@/hooks/queries'
import { api } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { RssIcon } from '@heroicons/react/20/solid'
import { LanguageOutlined, MailOutline } from '@mui/icons-material'
import {
  CreatePersonalAccessTokenResponse,
  ListResourceOrganizationCustomer,
  Organization,
  OrganizationProfileSettings,
  Product,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { externalURL } from '.'
import { DonateWidget } from '../Donations/DontateWidget'
import GitHubIcon from '../Icons/GitHubIcon'
import { Modal, ModalHeader } from '../Modal'
import { useModal } from '../Modal/useModal'
import { DescriptionEditor } from '../Profile/DescriptionEditor/DescriptionEditor'
import Spinner from '../Shared/Spinner'
import { FreeTierSubscribe } from './FreeTierSubscribe'

interface OrganizationPublicSidebarProps {
  organization: Organization
  organizationCustomers: ListResourceOrganizationCustomer
  userAdminOrganizations: Organization[]
  products: Product[]
}

export const OrganizationPublicSidebar = ({
  organization,
  organizationCustomers,
  userAdminOrganizations,
  products,
}: OrganizationPublicSidebarProps) => {
  const segment = useSelectedLayoutSegment()

  const {
    isShown: rssModalIsShown,
    hide: hideRssModal,
    show: showRssModal,
  } = useModal()

  const freeSubscriptionTier = products.find(
    (tier) => tier.type === SubscriptionTierType.FREE,
  )

  const isAdmin = userAdminOrganizations.some((o) => o.id === organization.id)

  const shouldRenderSubscriberCount =
    (organizationCustomers.items?.length ?? 0) > 0

  const updateOrganizationMutation = useUpdateOrganization()

  const updateProfile = (setting: OrganizationProfileSettings) => {
    return updateOrganizationMutation
      .mutateAsync({
        id: organization.id,
        settings: {
          profile_settings: setting,
        },
      })
      .then(() => revalidate(`organization:${organization.name}`))
  }

  const updateDescription = (description: string) => {
    updateProfile({
      description,
    })
  }

  const isPostView = segment === 'posts'
  const isDonatePage = segment === 'donate'

  return (
    <div className="flex h-full w-full flex-col items-start gap-y-6 md:max-w-[18rem]">
      <div className="flex w-full flex-row items-center gap-x-4 gap-y-6 md:flex-col md:items-start md:gap-x-0">
        <Avatar
          className="h-16 w-16 md:mb-6 md:h-32 md:w-32 lg:h-60 lg:w-60"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
        <div className="flex flex-col md:gap-y-2">
          <h1 className="text-xl text-gray-800 md:text-2xl dark:text-white">
            {organization.pretty_name ?? organization.name}
          </h1>
          {organization.pretty_name && (
            <Link
              className="text-blue-500 hover:text-blue-400 md:text-lg dark:text-blue-400 dark:hover:text-blue-300"
              href={`/${organization.name}`}
            >
              @{organization.name}
            </Link>
          )}
        </div>
      </div>
      <div
        className={twMerge(
          'flex w-full flex-col items-start gap-y-6 md:max-w-[15rem] lg:w-60',
          isPostView ? 'hidden  md:flex' : 'flex',
        )}
      >
        <div className="flex w-full flex-col gap-y-6">
          <DescriptionEditor
            className="dark:text-polar-500 text-md text-start leading-relaxed text-gray-500"
            description={
              organization.profile_settings?.description ??
              organization.bio ??
              ''
            }
            onChange={updateDescription}
            disabled={!isAdmin}
            size="small"
            loading={updateOrganizationMutation.isPending}
            failed={updateOrganizationMutation.isError}
            maxLength={160}
          />
          <div className="flex flex-row flex-wrap items-center gap-3 text-lg">
            <SocialLink href={`https://github.com/${organization.name}`}>
              <GitHubIcon width={20} height={20} />
            </SocialLink>
            {organization.twitter_username && (
              <SocialLink
                href={`https://twitter.com/${organization.twitter_username}`}
              >
                <svg
                  width="15"
                  height="15"
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
            )}
            {organization.blog && (
              <SocialLink href={externalURL(organization.blog)}>
                <LanguageOutlined fontSize="small" />
              </SocialLink>
            )}
            {organization.email && (
              <SocialLink href={`mailto:${organization.email}`}>
                <MailOutline fontSize="small" />
              </SocialLink>
            )}
            <Button
              className="dark:bg-transparent p-0 dark:hover:bg-transparent dark:text-polar-400 dark:hover:text-white flex flex-col items-center justify-center rounded-full border-none bg-transparent text-gray-500 hover:text-blue-500 transition-colors hover:bg-transparent"
              onClick={showRssModal}
              variant="secondary"
            >
              <RssIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {(organization.feature_settings?.subscriptions_enabled ||
          organization.feature_settings?.articles_enabled) && (
          <div className="flex w-full flex-col gap-y-6">
            {freeSubscriptionTier && !isAdmin ? (
              <>
                <FreeTierSubscribe
                  product={freeSubscriptionTier}
                  organization={organization}
                  upsellSubscriptions
                />
              </>
            ) : null}
            {shouldRenderSubscriberCount && (
              <div className="flex flex-row items-center gap-x-4">
                <div className="flex w-fit flex-shrink-0 flex-row items-center md:hidden lg:flex">
                  {organizationCustomers.items?.map((user, i, array) => (
                    <Avatar
                      className={twMerge(
                        'h-10 w-10',
                        i !== array.length - 1 && '-mr-3',
                      )}
                      key={i}
                      name={user.public_name ?? ''}
                      avatar_url={user.avatar_url}
                      height={40}
                      width={40}
                    />
                  ))}
                </div>
                <span className="text-sm">
                  {Intl.NumberFormat('en-US', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(organizationCustomers.pagination.total_count)}{' '}
                  {organizationCustomers.pagination.total_count === 1
                    ? 'Subscriber'
                    : 'Subscribers'}
                </span>
              </div>
            )}
          </div>
        )}

        {organization.donations_enabled && !isDonatePage ? (
          <DonateWidget organization={organization} />
        ) : null}
      </div>
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

const SocialLink = (props: PropsWithChildren<{ href: string }>) => {
  return (
    <Link
      target="_blank"
      rel="noopener nofollow"
      className="dark:bg-transparent dark:text-polar-400 dark:hover:text-white flex flex-col items-center justify-center rounded-full bg-transparent text-gray-500 hover:text-blue-500 transition-colors hover:bg-transparent"
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
  const url = `${CONFIG.FRONTEND_BASE_URL}/${organization.name}/rss${auth}`

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let active = true

    api.personalAccessToken
      .create({
        createPersonalAccessToken: {
          comment: `RSS for ${organization.name}`,
          scopes: ['organizations:read', 'articles:read'],
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
        <h3 className="text-lg font-medium text-gray-950 dark:text-white">
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
