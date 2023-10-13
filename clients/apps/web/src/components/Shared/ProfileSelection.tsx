import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import {
  AddOutlined,
  ContactSupportOutlined,
  LogoutOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CONFIG } from 'polarkit/config'
import { useListOrganizations } from 'polarkit/hooks'
import { classNames, clsx, useOutsideClick } from 'polarkit/utils'
import React, { useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks'
import { backerRoutes } from '../Dashboard/navigation'

const ProfileSelection = ({
  useOrgFromURL = true,
  className = '',
  narrow = true,
  showBackerLinks = false,
}) => {
  const classNames = clsx(
    'relative flex w-full flex-col rounded-xl bg-white dark:bg-polar-800 hover:bg-gray-100/50 dark:shadow-none dark:hover:bg-polar-700',
    className,
  )
  const { currentUser: loggedUser, logout } = useAuth()
  const listOrganizationQuery = useListOrganizations()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgs = listOrganizationQuery?.data?.items

  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const currentOrg = useMemo(() => {
    return currentOrgFromURL && useOrgFromURL ? currentOrgFromURL : undefined
  }, [currentOrgFromURL, useOrgFromURL])

  const router = useRouter()

  const onLogout = async () => {
    await logout()
    router.push('/')
  }

  if (!loggedUser) {
    return <></>
  }

  const current = currentOrg
    ? ({
        type: 'maintainer',
        name: currentOrg.name,
        avatar_url: currentOrg.avatar_url,
      } as const)
    : ({
        type: 'backer',
        name: loggedUser.username,
        avatar_url: loggedUser.avatar_url,
      } as const)

  const showConnectUsell = orgs && orgs.length === 0
  const showAddOrganization = !showConnectUsell

  return (
    <>
      <div className={classNames}>
        <div
          className={clsx(
            'relative flex cursor-pointer flex-row items-center justify-between gap-x-2 px-4 transition-colors',
            narrow ? 'py-2' : 'py-3',
          )}
          onClick={() => setOpen(true)}
        >
          <Profile
            name={current.name}
            avatar_url={current.avatar_url}
            type={current.type}
          />
          <ChevronUpDownIcon className="dark:text-polar-500 h-5 w-5 flex-shrink-0 text-gray-400" />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={clsx(
              'dark:bg-polar-700 dark:text-polar-400 absolute left-0 w-full overflow-hidden rounded-2xl bg-white py-2 shadow-xl',
              narrow ? '-top-2' : '-top-1',
            )}
          >
            <ul>
              <Link href="/feed" className="w-full">
                <ListItem current={currentOrg === undefined}>
                  <Profile
                    name={loggedUser.username}
                    avatar_url={loggedUser.avatar_url}
                    type="backer"
                  />
                </ListItem>
              </Link>

              {showBackerLinks && (
                <>
                  {backerRoutes.map((n) => {
                    return (
                      <LinkItem href={n.link} icon={n.icon}>
                        <span className="dark:text-polar-400 mx-1.5 text-gray-600">
                          {n.title}
                        </span>
                      </LinkItem>
                    )
                  })}

                  <hr className="dark:border-polar-600 my-2 ml-4 mr-4" />
                </>
              )}

              {orgs &&
                orgs.map((org) => (
                  <Link
                    href={`/maintainer/${org.name}/issues`}
                    className="w-full"
                  >
                    <ListItem key={org.id} current={currentOrg?.id === org.id}>
                      <Profile
                        name={org.name}
                        avatar_url={org.avatar_url}
                        type="maintainer"
                      />
                    </ListItem>
                  </Link>
                ))}

              {showAddOrganization && (
                <LinkItem
                  href={CONFIG.GITHUB_INSTALLATION_URL}
                  icon={<AddOutlined className="text-blue-600" />}
                >
                  <span className="mx-1.5 text-blue-600">Add organization</span>
                </LinkItem>
              )}

              <hr className="dark:border-polar-600 my-2 ml-4 mr-4" />

              <LinkItem
                href={'https://polar.sh/faq'}
                icon={
                  <ContactSupportOutlined className="dark:text-polar-400 text-gray-600" />
                }
              >
                <span className="dark:text-polar-400  mx-1.5 text-gray-600">
                  Support
                </span>
              </LinkItem>

              <TextItem
                onClick={onLogout}
                icon={
                  <LogoutOutlined className="dark:text-polar-400 text-gray-600" />
                }
              >
                <span className="dark:text-polar-400  mx-1.5 text-gray-600">
                  Log out
                </span>
              </TextItem>
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

export default ProfileSelection

const ListItem = (props: {
  children: React.ReactElement
  current: boolean
  className?: string
}) => {
  const className = classNames(
    'animate-background duration-10 flex items-center gap-2 py-2 px-4 w-full',
    props.current
      ? 'bg-blue-50 dark:bg-white/5'
      : 'hover:bg-gray-100/50 dark:hover:bg-polar-800',
    props.className ?? '',
  )

  return <li className={className}>{props.children}</li>
}

const Profile = (props: {
  name: string
  avatar_url: string | undefined
  type: 'backer' | 'maintainer'
}) => {
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
          <p className="dark:text-polar-300 ml-4 truncate text-gray-600 ">
            {props.name}
          </p>
        </div>
        <ProfileBadge type={props.type} />
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
      <ListItem current={false} className="px-6">
        <div className="flex flex-row items-center gap-x-2 text-sm">
          {props.icon && (
            <div className="text-[20px]">
              {React.cloneElement(props.icon, {
                fontSize: 'inherit',
              })}
            </div>
          )}
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
      <ListItem current={false} className="px-6">
        <>
          <div className="text-[20px]">
            {React.cloneElement(props.icon, {
              fontSize: 'inherit',
            })}
          </div>
          {props.children}
        </>
      </ListItem>
    </div>
  )
}

const ProfileBadge = (props: { type: 'backer' | 'maintainer' }) => {
  return (
    <span
      className={clsx(
        props.type === 'backer' &&
          'border-green-200 bg-green-100 text-green-600 dark:border-green-600 dark:bg-green-700 dark:text-green-300',
        props.type === 'maintainer' &&
          'border-blue-200 bg-blue-100 text-blue-600 dark:border-blue-600 dark:bg-blue-700 dark:text-blue-300',
        'shrink-0 rounded-lg border px-1.5 text-xs',
      )}
    >
      {props.type === 'backer' && 'Backer'}
      {props.type === 'maintainer' && 'Maintainer'}
    </span>
  )
}
