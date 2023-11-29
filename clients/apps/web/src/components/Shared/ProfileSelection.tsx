'use client'

import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  LogoutOutlined,
  ShortTextOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { Avatar } from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { CONFIG } from 'polarkit/config'
import { useListAllOrganizations } from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import React, { useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../hooks'
import { backerRoutes } from '../Dashboard/navigation'

const ProfileSelection = ({
  useOrgFromURL = true,
  className = '',
  showBackerLinks = false,
}) => {
  const classNames = twMerge(
    'relative flex w-full flex-col rounded-xl bg-white dark:bg-polar-800 hover:bg-gray-100/50 dark:shadow-none dark:hover:bg-polar-700 dark:border dark:border-polar-700 transition-colors',
    className,
  )
  const { currentUser: loggedUser, logout } = useAuth()
  const listOrganizationQuery = useListAllOrganizations()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgs = listOrganizationQuery?.data?.items ?? []

  const organizationsExceptSelf = orgs.filter(
    (org) => org.name !== loggedUser?.username,
  )

  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const currentOrg = useMemo(() => {
    return currentOrgFromURL && useOrgFromURL ? currentOrgFromURL : undefined
  }, [currentOrgFromURL, useOrgFromURL])

  const onLogout = async () => {
    await logout()
    window.location.href = '/'
  }

  if (!loggedUser) {
    return <></>
  }

  const current = currentOrg
    ? ({
        name: currentOrg.name,
        avatar_url: currentOrg.avatar_url,
      } as const)
    : ({
        name: loggedUser.username,
        avatar_url: loggedUser.avatar_url,
      } as const)

  const showConnectUpsell = orgs && orgs.length === 0
  const showAddOrganization = !showConnectUpsell

  return (
    <>
      <div className={classNames}>
        <div
          className={twMerge(
            'relative flex cursor-pointer flex-row items-center justify-between gap-x-2 px-4 py-3 transition-colors',
          )}
          onClick={() => setOpen(true)}
        >
          <Profile name={current.name} avatar_url={current.avatar_url} />
          <ChevronUpDownIcon className="dark:text-polar-500 h-5 w-5 flex-shrink-0 text-gray-400" />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={twMerge(
              'dark:bg-polar-800 dark:text-polar-400 dark:border-polar-700 absolute -left-2 -right-2 -top-1 overflow-hidden rounded-2xl bg-white p-2 shadow-xl dark:border',
            )}
          >
            <Link
              // /feed is actually the funding page
              // /posts is the new feed
              href={isFeatureEnabled('feed') ? `/posts` : `/feed`}
              className="w-full"
            >
              <ListItem
                current={
                  currentOrg === undefined ||
                  currentOrg.name === loggedUser.username
                }
              >
                <Profile
                  name={loggedUser.username}
                  avatar_url={loggedUser.avatar_url}
                />
              </ListItem>
            </Link>

            <ul className="mt-2 flex w-full flex-col">
              {showBackerLinks && (
                <>
                  {backerRoutes(currentOrg).map((n) => {
                    return (
                      <LinkItem href={n.link} icon={n.icon}>
                        <span className="mx-1.5 font-medium">{n.title}</span>
                      </LinkItem>
                    )
                  })}
                </>
              )}

              <TextItem
                onClick={onLogout}
                icon={<LogoutOutlined fontSize="small" />}
              >
                <span className="mx-3">Log out</span>
              </TextItem>
            </ul>

            <div className="mt-2 flex w-full flex-row items-center gap-x-2 py-4">
              <div
                className="dark:text-polar-400 px-3 py-1 text-[10px] uppercase tracking-widest text-gray-500"
                style={{ fontFeatureSettings: `"ss02" on` }}
              >
                Organizations
              </div>
            </div>

            <div className="mb-2 flex flex-col">
              {organizationsExceptSelf &&
                organizationsExceptSelf.map((org) => (
                  <Link
                    href={
                      isFeatureEnabled('feed')
                        ? `/maintainer/${org.name}/posts`
                        : `/maintainer/${org.name}/issues`
                    }
                    className="w-full"
                    key={org.id}
                  >
                    <ListItem current={currentOrg?.id === org.id}>
                      <Profile name={org.name} avatar_url={org.avatar_url} />
                    </ListItem>
                  </Link>
                ))}
            </div>

            {showAddOrganization && (
              <LinkItem
                href={CONFIG.GITHUB_INSTALLATION_URL}
                icon={
                  <AddOutlined
                    fontSize="small"
                    className="h-5 w-5 text-blue-500 dark:text-blue-400"
                  />
                }
              >
                <span className="mx-2 text-blue-500 dark:text-blue-400">
                  Add organization
                </span>
              </LinkItem>
            )}

            {showConnectUpsell && (
              <div className="dark:bg-polar-800 dark:text-polar-400 mx-4 my-4 flex flex-col rounded-lg border-blue-100 bg-blue-50 p-4 text-sm">
                <h3>Get funding for your public repositories.</h3>
                <Link
                  href={CONFIG.GITHUB_INSTALLATION_URL}
                  className="mt-2 text-blue-500 dark:text-blue-400"
                >
                  Connect repositories
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default ProfileSelection

export const ProfileMenu = ({ className = '' }) => {
  const classNames = twMerge('relative', className)
  const { currentUser: loggedUser, logout } = useAuth()

  const [isOpen, setOpen] = useState<boolean>(false)

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const onLogout = async () => {
    await logout()
    window.location.href = '/'
  }

  if (!loggedUser) {
    return <></>
  }

  return (
    <>
      <div className={classNames}>
        <div
          className={twMerge(
            'dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-700 dark:text-polar-400 dark:hover:text-polar-200 relative flex cursor-pointer flex-row items-center gap-x-2 rounded-full border border-gray-100 bg-white p-1.5 pl-4 text-gray-400 transition-colors hover:text-gray-950',
          )}
          onClick={() => setOpen(true)}
        >
          <ShortTextOutlined fontSize="small" />
          <Avatar
            className="h-8 w-8"
            name={loggedUser.username}
            avatar_url={loggedUser.avatar_url}
          />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={twMerge(
              'dark:bg-polar-800 dark:text-polar-400 dark:border-polar-700 absolute right-0 top-14 z-50 w-[300px] overflow-hidden rounded-2xl bg-white p-2 shadow-xl dark:border',
            )}
          >
            <Link
              // /feed is actually the funding page
              // /posts is the new feed
              href={isFeatureEnabled('feed') ? `/posts` : `/feed`}
              className="w-full"
            >
              <ListItem current={true}>
                <Profile
                  name={loggedUser.username}
                  avatar_url={loggedUser.avatar_url}
                />
              </ListItem>
            </Link>

            <ul className="mt-2 flex w-full flex-col">
              {backerRoutes
                .filter((route) => ('if' in route ? route.if : true))
                .map((n) => {
                  return (
                    <LinkItem href={n.link} icon={n.icon}>
                      <span className="mx-2 text-sm">{n.title}</span>
                    </LinkItem>
                  )
                })}

              <Separator className="my-2" />

              <TextItem
                onClick={onLogout}
                icon={<LogoutOutlined fontSize="small" />}
              >
                <span className="mx-3 py-2">Log out</span>
              </TextItem>
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

const ListItem = (props: {
  children: React.ReactElement
  current: boolean
  className?: string
}) => {
  const className = twMerge(
    'animate-background duration-10 flex items-center gap-2 py-2 px-4 w-full rounded-lg transition-colors',
    props.current
      ? 'bg-blue-50 dark:bg-polar-700 text-blue-500 dark:text-blue-50'
      : 'hover:text-blue-500 dark:hover:text-polar-50',
    props.className ?? '',
  )

  return <li className={className}>{props.children}</li>
}

const Profile = (props: { name: string; avatar_url: string | undefined }) => {
  return (
    <>
      <div className="flex w-full min-w-0 shrink grow-0 items-center justify-between text-sm">
        <div className="flex w-full min-w-0 shrink grow-0 items-center">
          {props.avatar_url && (
            <img
              src={props.avatar_url}
              className="h-8 w-8 rounded-full"
              alt={props.name}
            />
          )}
          <p className="ml-4 truncate">{props.name}</p>
        </div>
      </div>
    </>
  )
}

const LinkItem = (props: {
  href: string
  icon?: React.ReactElement
  children: React.ReactElement
}) => {
  return (
    <a href={props.href}>
      <ListItem current={false} className="rounded-lg px-6">
        <div className="flex flex-row items-center gap-x-3 text-sm">
          <span className="text-lg">{props.icon}</span>
          {props.children}
        </div>
      </ListItem>
    </a>
  )
}

const TextItem = (props: {
  onClick: () => void
  icon: React.ReactElement
  children: React.ReactElement
}) => {
  return (
    <div
      className="flex cursor-pointer items-center text-sm"
      onClick={props.onClick}
    >
      <ListItem current={false} className="px-6 py-0">
        <>
          <span className="text-lg">{props.icon}</span>
          {props.children}
        </>
      </ListItem>
    </div>
  )
}
