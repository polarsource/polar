import {
  CodeBracketIcon as CodeBracketIconSmall,
  PlusIcon,
} from '@heroicons/react/20/solid'
import { Command } from 'cmdk'
import Image from 'next/image'
import {
  Organization,
  OrganizationPrivateRead,
  Repository,
  UserRead,
} from 'polarkit/api/client'
import { CONFIG } from 'polarkit/config'
import { useOutsideClick } from 'polarkit/utils'
import React, { KeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Badge,
  Icon,
  Item,
  Left,
  Loading,
  SelectedBox,
  Text,
} from '../Dropdown'

const plural = (num: number, singular: string, plural: string): string => {
  if (num === 1) {
    return singular
  }
  return plural
}

export function RepoSelection(props: {
  showRepositories?: boolean
  showConnectMore?: boolean
  onSelectRepo?: (org: string, repo: string) => void
  onSelectOrg?: (org: string) => void
  onSelectUser?: () => void
  currentOrg?: OrganizationPrivateRead
  currentRepo?: Repository
  fullWidth?: boolean
  showUserInDropdown?: boolean
  defaultToUser?: boolean
  showOrganizationRepositoryCount?: boolean
  organizations: OrganizationPrivateRead[]
  currentUser: UserRead
  initOpen?: boolean
}) {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)

  const [open, setOpen] = React.useState(!!props.initOpen)

  useEffect(() => {
    inputRef?.current?.focus()
  }, [])

  const { organizations, currentUser } = props

  const [dropdownSelectedOrg, setDropdowndropdownSelectedOrg] = useState<
    Organization | undefined
  >()

  const resetDropdown = () => {
    setOpen(false)
    setDropdowndropdownSelectedOrg(undefined)
    setInputValue('')
  }

  const onSelectOrg = (org: Organization) => {
    // If show repositories, open selection to show repositories
    if (props.showRepositories) {
      // Select org again, go to it!
      if (dropdownSelectedOrg && dropdownSelectedOrg.id === org.id) {
        resetDropdown()
        if (props.onSelectOrg) {
          props.onSelectOrg(org.name)
        }
        return
      }

      setDropdowndropdownSelectedOrg(org)
      setInputValue('')
      return
    }

    // If not show repositories, navigate straight away
    resetDropdown()
    if (props.onSelectOrg) {
      props.onSelectOrg(org.name)
    }
  }

  const onSelectRepo = (org: Organization, repo: Repository) => {
    if (org && repo) {
      resetDropdown()
      if (props.onSelectRepo) {
        props.onSelectRepo(org.name, repo.name)
      }
    }
  }

  const onSelectUser = () => {
    if (props.onSelectUser) {
      props.onSelectUser()
    }
  }

  const onValueChange = (search: string) => {
    setValue(search)
  }

  const [orgIsBackspaceHighlighted, setOrgIsBackspaceHighlighted] =
    useState(false)

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Backspace once to select, backspace again to delete
    if (e.code === 'Backspace' && inputValue === '') {
      if (orgIsBackspaceHighlighted) {
        setDropdowndropdownSelectedOrg(undefined)
        setOrgIsBackspaceHighlighted(false)
      } else {
        setOrgIsBackspaceHighlighted(true)
      }
    } else if (e.code === 'Escape') {
      setOpen(false)
    } else {
      // If was selected and not backspace, undo selection
      setOrgIsBackspaceHighlighted(false)
    }
  }

  type ListOrg = OrganizationPrivateRead & { unfilteredRepositoryCount: number }

  const [listOrgs, setListOrgs] = useState<ListOrg[]>([])

  // Value in <input>
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    let orgs: ListOrg[] = []

    // No selected org, and no search: show only orgs
    if (dropdownSelectedOrg === undefined && inputValue === '') {
      orgs =
        organizations?.map((o) => {
          return {
            ...o,
            repositories: [],
            unfilteredRepositoryCount: o.repositories?.length || 0,
          }
        }) || []
    } else if (dropdownSelectedOrg === undefined && organizations) {
      orgs = organizations.map((o) => {
        return {
          ...o,
          unfilteredRepositoryCount: o.repositories?.length || 0,
        }
      })
    } else if (dropdownSelectedOrg) {
      // selected org
      orgs =
        organizations
          ?.filter((o) => o.id === dropdownSelectedOrg.id)
          .map((o) => {
            return {
              ...o,
              unfilteredRepositoryCount: o.repositories?.length || 0,
            }
          }) || []
    } else {
      orgs = []
    }

    if (!props.showRepositories) {
      orgs = orgs.map((o) => {
        return {
          ...o,
          repositories: [],
        }
      })
    }

    setListOrgs(orgs)
  }, [dropdownSelectedOrg, organizations, inputValue, props.showRepositories])

  const onInputValueChange = (e: string) => {
    setValue(e)
    setInputValue(e)
  }

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const [showUserInDropdown, setShowUserInDropdown] = useState(false)

  useEffect(() => {
    const haveSelfOrg = organizations?.find(
      (o) => o.name === currentUser?.username,
    )
    setShowUserInDropdown(
      !haveSelfOrg &&
        !!props.showUserInDropdown &&
        dropdownSelectedOrg === undefined,
    )
  }, [
    props.showUserInDropdown,
    organizations,
    currentUser,
    dropdownSelectedOrg,
  ])

  const width = props.fullWidth
    ? 'min-w-full max-w-full w-full'
    : 'min-w-[320px] max-w-[500px]'
  const placeholder = props.showRepositories
    ? 'Search orgs and repos...'
    : 'Search orgs...'

  if (!currentUser) {
    return <Loading />
  }
  if (!organizations) {
    return <Loading />
  }

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      {props.currentOrg && (
        <SelectedOrgRepo
          org={props.currentOrg}
          repo={props.currentRepo}
          onClick={() => setOpen(true)}
        />
      )}

      {!props.currentOrg && !props.defaultToUser && (
        <SelectedEmpty onClick={() => setOpen(true)} />
      )}

      {!props.currentOrg && props.defaultToUser && (
        <SelectedEmptySelfUserPlaceholder
          onClick={() => setOpen(true)}
          user={currentUser}
        />
      )}

      {open && (
        <>
          <div className={`relative bg-red-200`}>
            <Command
              value={value}
              onValueChange={onValueChange}
              className={`${width} !absolute -top-10 z-10 w-max rounded-lg bg-white shadow-lg dark:border dark:border-gray-600 dark:bg-gray-700`}
            >
              <div className="flex items-center px-2">
                {dropdownSelectedOrg && (
                  <>
                    <div
                      className={`flex-shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-medium	transition-colors duration-100 hover:bg-gray-100 dark:hover:bg-gray-600    ${
                        orgIsBackspaceHighlighted ? ' bg-neutral-100' : ''
                      }`}
                      onClick={() => {
                        setOrgIsBackspaceHighlighted(true)
                      }}
                    >
                      {dropdownSelectedOrg.name}
                    </div>
                    <div className="flex-shrink-0 text-gray-400">/</div>
                  </>
                )}
                <Command.Input
                  ref={inputRef}
                  autoFocus
                  placeholder={placeholder}
                  className="m-0 px-2 py-3 !text-sm !text-gray-900 focus:border-0 focus:ring-0 dark:!text-gray-200"
                  onKeyDown={onInputKeyDown}
                  value={inputValue}
                  onValueChange={onInputValueChange}
                />
              </div>
              <hr className="dark:border-gray-600" />
              <Command.List
                ref={listRef}
                className="max-h-[500px] overflow-auto overscroll-contain px-2 pb-2"
              >
                <Command.Empty className="p !h-auto !justify-start !p-2 !pt-3">
                  No results found.
                </Command.Empty>

                {listOrgs.map((org) => (
                  <React.Fragment key={org.id}>
                    <Item
                      value={`${org.name}`}
                      onSelect={() => onSelectOrg(org)}
                    >
                      <Left>
                        <Avatar url={org.avatar_url} />
                        <Text>{org.name}</Text>
                      </Left>

                      {!dropdownSelectedOrg &&
                        props.showOrganizationRepositoryCount && (
                          <Badge>
                            {org.unfilteredRepositoryCount}{' '}
                            {plural(
                              org.unfilteredRepositoryCount,
                              'repo',
                              'repos',
                            )}
                          </Badge>
                        )}
                    </Item>
                    {org.repositories &&
                      org.repositories.map((r) => (
                        <Item
                          value={`${org.name}/${r.name}`}
                          key={r.id}
                          onSelect={() => onSelectRepo(org, r)}
                        >
                          <Left>
                            <Icon>
                              <CodeBracketIconSmall className="block h-5 w-5 text-[#B2B2B2]" />
                            </Icon>

                            {dropdownSelectedOrg && <Text>{r.name}</Text>}

                            {!dropdownSelectedOrg && (
                              <Text>
                                {org.name} / {r.name}
                              </Text>
                            )}
                          </Left>
                        </Item>
                      ))}
                  </React.Fragment>
                ))}

                {showUserInDropdown && (
                  <Item
                    value={`${currentUser.username}`}
                    key={currentUser.id}
                    onSelect={onSelectUser}
                  >
                    <Left>
                      {currentUser.avatar_url && (
                        <Avatar url={currentUser.avatar_url} />
                      )}
                      <Text>{currentUser.username}</Text>
                    </Left>
                  </Item>
                )}

                {props.showConnectMore && (
                  <Item
                    value="Connect a repository"
                    onSelect={() => {
                      window.open(CONFIG.GITHUB_INSTALLATION_URL, '_blank')
                    }}
                  >
                    <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-500">
                      <Icon>
                        <PlusIcon className="block h-6 w-6" />
                      </Icon>
                      <Text>Connect a repository</Text>
                    </div>
                  </Item>
                )}
              </Command.List>
            </Command>
          </div>
        </>
      )}
    </div>
  )
}

export default RepoSelection

const SelectedOrgRepo = ({
  org,
  repo,
  onClick,
}: {
  org: Organization
  repo: Repository | undefined
  onClick: () => void
}) => {
  return (
    <SelectedBox onClick={onClick}>
      <div className="flex items-center justify-between space-x-2 ">
        <Image
          src={org.avatar_url}
          alt="Avatar"
          className="h-6 w-6 flex-shrink-0 rounded-full bg-white"
          height={200}
          width={200}
        />
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="flex-shrink-0 font-medium text-gray-900 dark:text-gray-200">
            {org.name}
          </span>

          {repo && (
            <>
              <span className="text-gray-400">/</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-gray-900 dark:text-gray-200">
                {repo.name}
              </span>
            </>
          )}
        </div>
      </div>
    </SelectedBox>
  )
}

const SelectedEmpty = ({ onClick }: { onClick: () => void }) => {
  return (
    <SelectedBox onClick={onClick}>
      <div className="text-gray-500">Select an organization</div>
    </SelectedBox>
  )
}

const SelectedEmptySelfUserPlaceholder = ({
  onClick,
  user,
}: {
  onClick: () => void
  user: UserRead
}) => {
  return (
    <SelectedBox onClick={onClick}>
      <div className="flex items-center justify-between space-x-2 ">
        {user.avatar_url && (
          <Image
            src={user.avatar_url}
            width={200}
            height={200}
            alt="Avatar"
            className="h-6 w-6 flex-shrink-0 rounded-full"
          />
        )}
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="flex-shrink-0 font-medium text-gray-900 dark:text-gray-200">
            {user.username}
          </span>
        </div>
      </div>
    </SelectedBox>
  )
}
