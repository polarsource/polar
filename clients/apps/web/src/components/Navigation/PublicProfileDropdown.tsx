'use client'

import { useLogout } from '@/hooks'
import { useListOrganizations } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import { useOutsideClick } from '@/utils/useOutsideClick'
import {
  AttachMoneyOutlined,
  Face,
  LogoutOutlined,
  ShoppingBagOutlined,
  SpaceDashboardOutlined,
} from '@mui/icons-material'
import { UserRead } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { Separator } from 'polarkit/components/ui/separator'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { LinkItem, ListItem, Profile, TextItem } from './Navigation'

const PublicProfileDropdown = ({
  className,
  authenticatedUser,
}: {
  className?: string
  authenticatedUser: UserRead | undefined
}) => {
  const classNames = twMerge('relative', className)
  const logout = useLogout()

  const [isOpen, setOpen] = useState<boolean>(false)

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const onLogout = async () => {
    await logout()
  }

  const loggedUser = authenticatedUser

  const organizations = useListOrganizations({ isMember: true })

  if (!loggedUser) {
    return <></>
  }

  return (
    <>
      <div className={classNames}>
        <div
          className={twMerge(
            'dark:border-polar-800 dark:hover:border-polar-600 relative flex flex-shrink-0 cursor-pointer flex-row items-center rounded-full border-2 border-blue-50 shadow-sm transition-colors hover:border-blue-100',
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
              'dark:bg-polar-900 dark:text-polar-400 dark:border-polar-800 absolute right-0 top-12 z-50 w-[300px] overflow-hidden rounded-3xl bg-white p-2 shadow-xl dark:border',
            )}
          >
            <Link
              href={`${CONFIG.FRONTEND_BASE_URL}/purchases`}
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
              {(organizations.data?.items.length ?? 0) > 0 && (
                <LinkItem
                  href={`${CONFIG.FRONTEND_BASE_URL}/dashboard`}
                  icon={<SpaceDashboardOutlined fontSize="inherit" />}
                >
                  <span className="mx-2 text-sm">Dashboard</span>
                </LinkItem>
              )}
              <LinkItem
                href={`${CONFIG.FRONTEND_BASE_URL}/purchases`}
                icon={<ShoppingBagOutlined fontSize="inherit" />}
              >
                <span className="mx-2 text-sm">Purchases</span>
              </LinkItem>
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

              <TextItem
                onClick={onLogout}
                icon={<LogoutOutlined fontSize="small" />}
              >
                <span className="mx-2 py-2">Log out</span>
              </TextItem>
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

export default PublicProfileDropdown
