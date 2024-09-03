'use client'

import { useAuth } from '@/hooks'
import { useUpdateOrganization } from '@/hooks/queries'
import { useExternalOrganizations } from '@/hooks/queries/externalOrganizations'
import { api } from '@/utils/api'
import { CONFIG } from '@/utils/config'
import { RssIcon } from '@heroicons/react/20/solid'
import { LanguageOutlined, MailOutline } from '@mui/icons-material'
import {
  ListResourceOrganizationCustomer,
  Organization,
  OrganizationProfileSettings,
  Platforms,
  Product,
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
import { SubscribeEditor } from '../Profile/SubscribeEditor/SubscribeEditor'
import Spinner from '../Shared/Spinner'

interface OrganizationPublicSidebarProps {
  organization: Organization
  organizationCustomers: ListResourceOrganizationCustomer | undefined
  userOrganizations: Organization[]
  products: Product[]
}

export const OrganizationPublicSidebar = ({
  organization,
  organizationCustomers,
  userOrganizations,
  products,
}: OrganizationPublicSidebarProps) => {
  const segment = useSelectedLayoutSegment()

  const {
    isShown: rssModalIsShown,
    hide: hideRssModal,
    show: showRssModal,
  } = useModal()

  const isOrgMember = userOrganizations.some((o) => o.id === organization.id)

  const updateOrganizationMutation = useUpdateOrganization()
  const externalGitHubOrganizations = useExternalOrganizations({
    organizationId: organization.id,
    platform: Platforms.GITHUB,
    limit: 1,
    sorting: ['created_at'],
  })

  const updateProfile = (setting: OrganizationProfileSettings) => {
    return updateOrganizationMutation.mutateAsync({
      id: organization.id,
      body: {
        profile_settings: setting,
      },
    })
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
          className="h-16 w-16 text-lg md:mb-6 md:h-32 md:w-32 md:text-6xl lg:h-60 lg:w-60"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
        <div className="flex flex-col md:gap-y-2">
          <h1 className="text-xl text-gray-800 md:text-2xl dark:text-white">
            {organization.name}
          </h1>
          <Link
            className="text-blue-500 hover:text-blue-400 md:text-lg dark:text-blue-400 dark:hover:text-blue-300"
            href={`/${organization.slug}`}
          >
            @{organization.slug}
          </Link>
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
            disabled={!isOrgMember}
            size="small"
            loading={updateOrganizationMutation.isPending}
            failed={updateOrganizationMutation.isError}
            maxLength={160}
          />
          <div className="flex flex-row flex-wrap items-center gap-3 text-lg">
            {externalGitHubOrganizations.data?.items.map(
              (externalOrganization) => (
                <SocialLink
                  key={externalOrganization.id}
                  href={`https://github.com/${externalOrganization.name}`}
                >
                  <GitHubIcon width={20} height={20} />
                </SocialLink>
              ),
            )}
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
              className="dark:text-polar-400 flex flex-col items-center justify-center rounded-full border-none bg-transparent p-0 text-gray-500 transition-colors hover:bg-transparent hover:text-blue-500 dark:bg-transparent dark:hover:bg-transparent dark:hover:text-white"
              onClick={showRssModal}
              variant="secondary"
            >
              <RssIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <SubscribeEditor
          organization={organization}
          customerList={organizationCustomers}
          products={products}
          isOrgMember={isOrgMember}
        />

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
      className="dark:text-polar-400 flex flex-col items-center justify-center rounded-full bg-transparent text-gray-500 transition-colors hover:bg-transparent hover:text-blue-500 dark:bg-transparent dark:hover:text-white"
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
  const url = `${CONFIG.FRONTEND_BASE_URL}/${organization.slug}/rss${auth}`

  useEffect(() => {
    if (!currentUser) {
      return
    }

    let active = true

    api.personalAccessToken
      .createPersonalAccessToken({
        body: {
          comment: `RSS for ${organization.slug}`,
          scopes: ['organizations:read', 'articles:read'],
        },
      })
      .then((res) => {
        if (active) {
          setToken(res.token)
        }
      })

    return () => {
      active = false
    }
  }, [currentUser, organization])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="text-lg font-medium text-gray-950 dark:text-white">
          Subscribe to {organization.name} via RSS
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
