import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import {
  ArrowRightOnRectangleIcon,
  PlusSmallIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { CONFIG } from 'polarkit/config'
import { useListOrganizations } from 'polarkit/hooks'
import { clsx, useOutsideClick } from 'polarkit/utils'
import React, { useRef, useState } from 'react'
import { useAuth } from '../../hooks'

interface Props {}

const ProfileSelection = (props: Props) => {
  const { currentUser: loggedUser, logout } = useAuth()
  const listOrganizationQuery = useListOrganizations()

  const [isOpen, setOpen] = useState<boolean>(false)

  const orgs = listOrganizationQuery?.data?.items

  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

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
      <div className="flex flex-col">
        {!isOpen && (
          <div className="shadow-hidden dark:hover:shadow-hidden relative cursor-pointer rounded-lg border border-transparent px-4 py-2 hover:border-blue-100 hover:shadow hover:dark:border-gray-800 dark:hover:bg-gray-900">
            <div onClick={() => setOpen(true)}>
              <Profile
                name={current.name}
                avatar_url={current.avatar_url}
                type={current.type}
              />
            </div>
          </div>
        )}

        {isOpen && (
          <div
            ref={ref}
            className={clsx(
              'absolute top-4 right-4 min-w-[300px] overflow-hidden rounded-lg border border-transparent bg-white shadow hover:border-blue-100 dark:bg-gray-900 hover:dark:border-gray-800',
            )}
          >
            <ul>
              <ListItem current={currentOrg === undefined}>
                <Link href="/feed">
                  <Profile
                    name={loggedUser.username}
                    avatar_url={loggedUser.avatar_url}
                    type="backer"
                  />
                </Link>
              </ListItem>

              {orgs &&
                orgs.map((org) => (
                  <ListItem key={org.id} current={currentOrg?.id === org.id}>
                    <Link href={`/maintainer/${org.name}/issues`}>
                      <Profile
                        name={org.name}
                        avatar_url={org.avatar_url}
                        type="maintainer"
                      />
                    </Link>
                  </ListItem>
                ))}

              {showConnectUsell && (
                <div className="my-2 mx-4 rounded-md border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900 dark:text-gray-300">
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

              <hr className="ml-6 mr-6" />

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
  return (
    <li className="animate-background duration-10 dark:hover:bg-gray-950/50 flex items-center gap-2 py-2 pl-3 pr-4 hover:bg-gray-200/50">
      {props.current && (
        <div className="h-2 w-2 rounded-full bg-blue-600"></div>
      )}
      {!props.current && <div className="h-2 w-2"></div>}
      {props.children}
    </li>
  )
}

const Profile = (props: {
  name: string
  avatar_url: string | undefined
  type: 'backer' | 'maintainer'
}) => {
  return (
    <>
      <div className="flex items-center text-sm">
        <img src={props.avatar_url} className="h-5 w-5 rounded-full" />
        <p className="mx-1.5 text-gray-600 dark:text-gray-400">{props.name}</p>
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
    <ListItem current={false}>
      <Link href={props.href}>
        <div className="flex items-center text-sm ">
          {props.icon}
          {props.children}
        </div>
      </Link>
    </ListItem>
  )
}

const TextItem = (props: {
  onClick: () => void
  icon: React.ReactElement
  children: React.ReactElement
}) => {
  return (
    <ListItem current={false}>
      <div
        className="flex cursor-pointer items-center text-sm"
        onClick={props.onClick}
      >
        {props.icon}
        {props.children}
      </div>
    </ListItem>
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
        'rounded-lg border px-1.5 text-xs',
      )}
    >
      {props.type === 'backer' && 'Backer'}
      {props.type === 'maintainer' && 'Maintainer'}
    </span>
  )
}
