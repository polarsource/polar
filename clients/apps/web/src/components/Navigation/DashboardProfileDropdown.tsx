'use client'

import {
  useCurrentOrgAndRepoFromURL,
  useGitHubAccount,
  useLogout,
} from '@/hooks'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { AddOutlined, LogoutOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { useListAllOrganizations } from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import { useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth, usePersonalOrganization } from '../../hooks'
import { backerRoutes } from '../Dashboard/navigation'
import { LinkItem, ListItem, Profile, TextItem } from './Navigation'

const DashboardProfileDropdown = ({
  useOrgFromURL = true,
  className = '',
  showBackerLinks = false,
}) => {
  const classNames = twMerge(
    'relative flex w-full flex-col rounded-xl bg-white dark:bg-polar-800 hover:bg-gray-100/50 dark:shadow-none dark:hover:bg-polar-700 dark:border dark:border-polar-700 transition-colors',
    className,
  )
  const { currentUser: loggedUser } = useAuth()
  const logout = useLogout()
  const listOrganizationQuery = useListAllOrganizations()
  const githubAccount = useGitHubAccount()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgs = listOrganizationQuery?.data?.items ?? []

  const organizationsExceptSelf = orgs.filter(
    (org) => org.name !== loggedUser?.username,
  )

  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const currentOrg = useMemo(() => {
    return currentOrgFromURL && useOrgFromURL ? currentOrgFromURL : undefined
  }, [currentOrgFromURL, useOrgFromURL])

  const onLogout = async () => {
    await logout()
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
            <>
              {personalOrg ? (
                <Link
                  href={`/maintainer/${personalOrg.name}/overview`}
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
              ) : null}
            </>

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

export default DashboardProfileDropdown
