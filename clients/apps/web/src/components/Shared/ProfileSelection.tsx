'use client'

import { useCurrentOrgAndRepoFromURL, useGitHubAccount } from '@/hooks'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { AddOutlined, LogoutOutlined } from '@mui/icons-material'
import { UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar } from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { useListAllOrganizations } from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import React, { useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth, usePersonalOrganization } from '../../hooks'
import { backerRoutes, dashboardRoutes } from '../Dashboard/navigation'

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
  const githubAccount = useGitHubAccount()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgs = listOrganizationQuery?.data?.items ?? []

  const organizationsExceptSelf = orgs.filter(
    (org) => org.name !== loggedUser?.username,
  )

  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()
  const isPersonalOrg = currentOrgFromURL?.id === personalOrg?.id

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const currentOrg = useMemo(() => {
    return currentOrgFromURL && useOrgFromURL ? currentOrgFromURL : undefined
  }, [currentOrgFromURL, useOrgFromURL])

  const onLogout = async () => {
    await logout()
    // Do not use the next router here. Trigger a full refresh.
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

  const showAddOrganization = !!githubAccount

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
            <Link href={'/feed'} className="w-full">
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
                  {backerRoutes().map((n) => {
                    return (
                      <LinkItem href={n.link} icon={n.icon} key={n.link}>
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

            {(organizationsExceptSelf.length > 0 || showAddOrganization) && (
              <div className="mt-2 flex w-full flex-row items-center gap-x-2 py-4">
                <div className="dark:text-polar-400 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-gray-500">
                  Organizations
                </div>
              </div>
            )}

            {organizationsExceptSelf.length > 0 && (
              <div className="mb-2 flex flex-col">
                {organizationsExceptSelf.map((org) => (
                  <Link
                    href={`/maintainer/${org.name}/overview`}
                    className="w-full"
                    key={org.id}
                  >
                    <ListItem current={currentOrg?.id === org.id}>
                      <Profile name={org.name} avatar_url={org.avatar_url} />
                    </ListItem>
                  </Link>
                ))}
              </div>
            )}

            {showAddOrganization && (
              <LinkItem
                href="/maintainer/new"
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
          </div>
        )}
      </div>
    </>
  )
}

export default ProfileSelection

export const ProfileMenu = ({
  className,
  authenticatedUser,
}: {
  className?: string
  authenticatedUser: UserRead | undefined
}) => {
  const classNames = twMerge('relative', className)
  const { logout } = useAuth()
  const personalOrg = usePersonalOrganization()

  const [isOpen, setOpen] = useState<boolean>(false)

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const onLogout = async () => {
    await logout()
    // Do not use the next router here. Trigger a full refresh.
    window.location.href = '/'
  }

  const loggedUser = authenticatedUser

  if (!loggedUser) {
    return <></>
  }

  return (
    <>
      <div className={classNames}>
        <div
          className={twMerge(
            'dark:border-polar-700 dark:hover:border-polar-600 relative flex cursor-pointer flex-row items-center rounded-full border-2 border-blue-50 shadow-sm transition-colors hover:border-blue-100',
          )}
          onClick={() => setOpen(true)}
        >
          <Avatar
            className="h-9 w-9"
            name={loggedUser.username}
            avatar_url={loggedUser.avatar_url}
          />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={twMerge(
              'dark:bg-polar-800 dark:text-polar-400 dark:border-polar-700 absolute right-0 top-12 z-50 w-[300px] overflow-hidden rounded-2xl bg-white p-2 shadow-xl dark:border',
            )}
          >
            <Link href={'/feed'} className="w-full">
              <ListItem current={true}>
                <Profile
                  name={loggedUser.username}
                  avatar_url={loggedUser.avatar_url}
                />
              </ListItem>
            </Link>

            <ul className="mt-2 flex w-full flex-col">
              {dashboardRoutes(personalOrg, true, true)
                .filter((route) => ('if' in route ? route.if : true))
                .map((n) => {
                  return (
                    <LinkItem href={n.link} icon={n.icon} key={n.link}>
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
