'use client'

import { useGitHubAccount, useLogout } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { CONFIG } from '@/utils/config'
import { useOutsideClick } from '@/utils/useOutsideClick'
import { AddOutlined, KeyboardArrowDownOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { useContext, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../hooks'
import { LinkItem, ListItem, Profile } from './Navigation'

const DashboardProfileDropdown = ({ className = '' }) => {
  const classNames = twMerge(
    'relative flex w-full flex-col rounded-full bg-gray-100 hover:bg-gray-75 dark:hover:bg-polar-700 dark:bg-polar-800 transition-colors z-50',
    className,
  )
  const { currentUser: loggedUser } = useAuth()
  const logout = useLogout()

  const githubAccount = useGitHubAccount()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgContext = useContext(MaintainerOrganizationContext)
  const currentOrg = orgContext?.organization
  const orgs = orgContext?.organizations ?? []

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const onLogout = async () => {
    await logout()
  }

  if (!loggedUser) {
    return <></>
  }

  const current = currentOrg
    ? ({
        name: currentOrg.slug,
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
            'relative flex cursor-pointer flex-row items-center justify-between gap-x-2 py-3 pl-3 pr-4 transition-colors',
          )}
          onClick={() => setOpen(true)}
        >
          <Profile name={current.name} avatar_url={current.avatar_url} />
          <KeyboardArrowDownOutlined className="dark:text-polar-50 h-5 w-5 flex-shrink-0 text-gray-400" />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={twMerge(
              'dark:bg-polar-800 dark:text-polar-400 rounded-4xl absolute -left-1 -top-1 right-0 overflow-hidden bg-white p-2 shadow-xl',
            )}
          >
            {orgs.length > 0 ? (
              <div className="mb-2 flex flex-col">
                {orgs.map((org) => (
                  <Link
                    href={`/maintainer/${org.slug}/overview`}
                    className="w-full"
                    key={org.id}
                  >
                    <ListItem current={currentOrg?.id === org.id}>
                      <Profile name={org.slug} avatar_url={org.avatar_url} />
                    </ListItem>
                  </Link>
                ))}
              </div>
            ) : null}

            {showAddOrganization ? (
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
                  Add GitHub Organization
                </span>
              </LinkItem>
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}

export default DashboardProfileDropdown
