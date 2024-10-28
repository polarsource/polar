'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { CONFIG } from '@/utils/config'
import { useOutsideClick } from '@/utils/useOutsideClick'
import {
  AddOutlined,
  BiotechOutlined,
  KeyboardArrowDownOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { useContext, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../hooks'
import { LinkItem, ListItem, Profile } from './Navigation'

const DashboardProfileDropdown = ({ className = '' }) => {
  const classNames = twMerge(
    'relative flex w-full flex-col rounded-full bg-gray-50 hover:bg-white dark:hover:bg-polar-800 dark:bg-polar-900 transition-colors z-40 border border-gray-200 dark:border-polar-800',
    className,
  )
  const { currentUser: loggedUser } = useAuth()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgContext = useContext(MaintainerOrganizationContext)
  const currentOrg = orgContext?.organization
  const orgs = orgContext?.organizations ?? []

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  if (!loggedUser) {
    return <></>
  }

  const current = currentOrg
    ? ({
        name: currentOrg.name,
        avatar_url: currentOrg.avatar_url,
      } as const)
    : ({
        name: loggedUser.email,
        avatar_url: loggedUser.avatar_url,
      } as const)

  return (
    <div className={classNames}>
      <div
        className={twMerge(
          'relative flex cursor-pointer flex-row items-center justify-between gap-x-2 py-2 pl-2 pr-4 transition-colors',
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
            'dark:bg-polar-900 dark:text-polar-400 rounded-4xl dark:border-polar-700 border:transparent absolute -left-2 -right-4 -top-2 overflow-hidden border bg-gray-50 p-2 shadow-xl',
          )}
        >
          {orgs.length > 0 ? (
            <div className="mb-2 flex flex-col">
              {orgs.map((org) => (
                <Link
                  href={`/dashboard/${org.slug}`}
                  className="w-full"
                  key={org.id}
                >
                  <ListItem current={currentOrg?.id === org.id}>
                    <Profile name={org.name} avatar_url={org.avatar_url} />
                  </ListItem>
                </Link>
              ))}
            </div>
          ) : null}

          <LinkItem
            href="/dashboard/create"
            icon={
              <AddOutlined
                fontSize="small"
                className="h-5 w-5 text-blue-500 dark:text-blue-400"
              />
            }
          >
            <span className="mx-2 text-blue-500 dark:text-blue-400">
              Create organization
            </span>
          </LinkItem>

          {!CONFIG.IS_SANDBOX && (
            <LinkItem
              href="https://sandbox.polar.sh/start"
              icon={
                <BiotechOutlined
                  fontSize="small"
                  className="h-5 w-5 text-blue-500 dark:text-blue-400"
                />
              }
            >
              <span className="mx-2 text-blue-500 dark:text-blue-400">
                Open Sandbox
              </span>
            </LinkItem>
          )}
        </div>
      )}
    </div>
  )
}

export default DashboardProfileDropdown
