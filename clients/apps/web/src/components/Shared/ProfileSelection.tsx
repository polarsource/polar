import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import {
  ArrowRightOnRectangleIcon,
  ChevronUpDownIcon,
  PlusSmallIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { CONFIG } from 'polarkit/config'
import { useListOrganizations } from 'polarkit/hooks'
import { classNames, clsx, useOutsideClick } from 'polarkit/utils'
import React, { useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks'

const ProfileSelection = ({ useOrgFromURL = true }) => {
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
      <div className="relative flex w-full flex-col">
        <div
          className="relative flex cursor-pointer flex-row items-center justify-between gap-x-2 rounded-2xl p-4 shadow-xl transition-colors hover:bg-gray-100/50 dark:border dark:border-transparent dark:bg-gray-950 dark:shadow-none dark:hover:border-gray-800"
          onClick={() => setOpen(true)}
        >
          <Profile
            name={current.name}
            avatar_url={current.avatar_url}
            type={current.type}
          />
          <ChevronUpDownIcon className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
        </div>

        {isOpen && (
          <div
            ref={ref}
            className={clsx(
              'absolute left-0 top-0 w-[286px] max-w-[286px] overflow-hidden rounded-2xl bg-white py-2 shadow-xl dark:bg-gray-950',
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

              {showConnectUsell && (
                <div className="mx-4 my-2 rounded-md border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900 dark:text-gray-300">
                  Get funding for your public repositories.
                  <br />
                  <Link
                    href={CONFIG.GITHUB_INSTALLATION_URL}
                    className="font-medium text-blue-600 dark:text-blue-500"
                  >
                    Connect repositories.
                  </Link>
                </div>
              )}

              {showAddOrganization && (
                <LinkItem
                  href={CONFIG.GITHUB_INSTALLATION_URL}
                  icon={<PlusSmallIcon className="h-5 w-5 text-blue-600" />}
                >
                  <span className="mx-1.5 text-blue-600">Add organization</span>
                </LinkItem>
              )}

              <hr className="my-2 ml-4 mr-4" />

              <LinkItem
                href={'https://polar.sh/faq'}
                icon={
                  <QuestionMarkCircleIcon className="h-5 w-5  text-gray-600 dark:text-gray-400" />
                }
              >
                <span className="mx-1.5  text-gray-600 dark:text-gray-400">
                  Support
                </span>
              </LinkItem>

              <TextItem
                onClick={logout}
                icon={
                  <ArrowRightOnRectangleIcon className="h-5 w-5  text-gray-600 dark:text-gray-400" />
                }
              >
                <span className="mx-1.5  text-gray-600 dark:text-gray-400">
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
}) => {
  const className = classNames(
    'animate-background duration-10 flex items-center gap-2 py-2 px-4',
    props.current
      ? 'bg-blue-50 dark:bg-white/5'
      : 'hover:bg-gray-100/50 dark:hover:bg-white/5',
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
          <p className="ml-4 truncate text-gray-600 dark:text-gray-400 ">
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
  icon: React.ReactElement
  children: React.ReactElement
}) => {
  return (
    <a href={props.href}>
      <ListItem current={false}>
        <div className="flex items-center gap-x-2 text-sm">
          {props.icon}
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
      className="flex cursor-pointer items-center text-sm hover:bg-gray-100/50 dark:hover:bg-white/5"
      onClick={props.onClick}
    >
      <ListItem current={false}>
        <>
          {props.icon}
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
