'use client'

import { useListOrganizations } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import { useOutsideClick } from '@/utils/useOutsideClick'
import {
  AttachMoneyOutlined,
  Face,
  LogoutOutlined,
  SpaceDashboardOutlined,
} from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { LinkItem, ListItem, Profile } from './Navigation'

const PublicProfileDropdown = ({
  className,
  authenticatedUser,
  anchor,
}: {
  className?: string
  authenticatedUser: schemas['UserRead'] | undefined
  anchor?: 'topbar' | 'bottombar'
}) => {
  const classNames = twMerge('relative', className)

  const [isOpen, setOpen] = useState<boolean>(false)

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const loggedUser = authenticatedUser

  const organizations = useListOrganizations({}, !!loggedUser)

  if (!loggedUser) {
    return <></>
  }

  return (
    <>
      <div className={classNames}>
        <div
          className={twMerge(
            'dark:border-polar-800 dark:hover:border-polar-700 relative flex flex-shrink-0 cursor-pointer flex-row items-center rounded-full border-2 border-gray-50 shadow-sm transition-colors hover:border-blue-100',
          )}
          onClick={() => setOpen(true)}
        >
          <Avatar
            className="h-8 w-8"
            name={loggedUser.email}
            avatar_url={loggedUser.avatar_url}
          />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={twMerge(
              'dark:bg-polar-900 dark:text-polar-400 dark:border-polar-700 absolute z-50 w-[300px] overflow-hidden rounded-3xl bg-white p-2 shadow-xl dark:border',
              anchor === 'bottombar' ? 'bottom-12 left-0' : 'right-0 top-12',
            )}
          >
            <Link href={`${CONFIG.FRONTEND_BASE_URL}/start`} className="w-full">
              <ListItem current={true}>
                <Profile
                  name={loggedUser.email}
                  avatar_url={loggedUser.avatar_url}
                />
              </ListItem>
            </Link>

            <ul className="mt-2 flex w-full flex-col">
              {(organizations.data?.items.length ?? 0) > 0 && (
                <LinkItem
                  href={`${CONFIG.FRONTEND_BASE_URL}/dashboard`}
                  icon={<SpaceDashboardOutlined fontSize="inherit" />}
                >
                  <span className="mx-2 text-sm">Dashboard</span>
                </LinkItem>
              )}
              <LinkItem
                href={`${CONFIG.FRONTEND_BASE_URL}/finance`}
                icon={<AttachMoneyOutlined fontSize="inherit" />}
              >
                <span className="mx-2 text-sm">Finance</span>
              </LinkItem>
              <LinkItem
                href={`${CONFIG.FRONTEND_BASE_URL}/settings`}
                icon={<Face fontSize="inherit" />}
              >
                <span className="mx-2 text-sm">Account</span>
              </LinkItem>

              <Separator className="my-2" />

              <LinkItem
                href={`${CONFIG.BASE_URL}/v1/auth/logout`}
                icon={<LogoutOutlined fontSize="small" />}
              >
                <span className="mx-2 py-2">Log out</span>
              </LinkItem>
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

export default PublicProfileDropdown
