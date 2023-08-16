import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import {
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline'
import { PlusSmallIcon } from '@heroicons/react/24/solid'
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

  return (
    <>
      <div className="flex flex-col">
        {!isOpen && (
          <div className="shadow-hidden relative cursor-pointer rounded-lg border border-transparent px-4 py-2 hover:border-blue-100 hover:shadow">
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
              'absolute top-4 right-4 min-w-[300px] rounded-lg border border-transparent bg-white shadow hover:border-blue-100',
            )}
          >
            <ul>
              <ListItem>
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
                  <ListItem key={org.id}>
                    <Link href={`/maintainer/${org.name}/issues`}>
                      <Profile
                        name={org.name}
                        avatar_url={org.avatar_url}
                        type="maintainer"
                      />
                    </Link>
                  </ListItem>
                ))}

              <LinkItem
                href={CONFIG.GITHUB_INSTALLATION_URL}
                icon={<PlusSmallIcon className="h-5 w-5 text-blue-600" />}
              >
                <span className="mx-1.5 text-blue-600">Add organization</span>
              </LinkItem>

              <hr className="mx-2" />

              <LinkItem
                href={'https://polar.sh/faq'}
                icon={
                  <QuestionMarkCircleIcon className="h-5 w-5 text-gray-600" />
                }
              >
                <span className="mx-1.5 text-gray-600">Support</span>
              </LinkItem>

              <TextItem
                onClick={logout}
                icon={
                  <ArrowRightOnRectangleIcon className="h-5 w-5 text-gray-600" />
                }
              >
                <span className="mx-1.5 text-gray-600">Log out</span>
              </TextItem>
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

export default ProfileSelection

const ListItem = (props: { children: React.ReactElement }) => {
  return (
    <li className="animate-background px-4 py-2 duration-100 hover:bg-gray-100/50">
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
        <p className="mx-1.5 text-gray-600">{props.name}</p>
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
    <ListItem>
      <Link href={props.href}>
        <div className="flex items-center text-sm">
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
    <ListItem>
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
  const isBacker = props.type === 'backer'

  return (
    <span
      className={clsx(
        isBacker && 'border-green-200 bg-green-100 text-green-600',
        !isBacker && 'border-blue-200 bg-blue-100 text-blue-600',
        'rounded-lg border px-1.5 text-xs',
      )}
    >
      {isBacker && 'Backer'}
      {!isBacker && 'Maintainer'}
    </span>
  )
}
