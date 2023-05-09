import {
  CodeBracketIcon as CodeBracketIconSmall,
  PlusIcon,
} from '@heroicons/react/20/solid'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Command } from 'cmdk'
import { useRequireAuth } from 'hooks'
import { OrganizationRead, RepositoryRead, UserRead } from 'polarkit/api/client'
import { CONFIG } from 'polarkit/config'
import { useUserOrganizations } from 'polarkit/hooks'
import { useOutsideClick } from 'polarkit/utils'
import React, { KeyboardEvent, useEffect, useRef, useState } from 'react'

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
  currentOrg?: OrganizationRead
  currentRepo?: RepositoryRead
  fullWidth?: boolean
  showUserInDropdown?: boolean
  defaultToUser?: boolean
  showOrganizationRepositoryCount?: boolean
}) {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)

  const [open, setOpen] = React.useState(false)

  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  useEffect(() => {
    inputRef?.current?.focus()
  }, [])

  const organizations = userOrgQuery.data

  const [dropdownSelectedOrg, setDropdowndropdownSelectedOrg] = useState<
    OrganizationRead | undefined
  >()

  const resetDropdown = () => {
    setOpen(false)
    setDropdowndropdownSelectedOrg(undefined)
    setInputValue('')
  }

  const onSelectOrg = (org: OrganizationRead) => {
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

  const onSelectRepo = (org: OrganizationRead, repo: RepositoryRead) => {
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

  type ListOrg = OrganizationRead & { unfilteredRepositoryCount: number }

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
  if (userOrgQuery.isLoading) return <Loading />
  if (!userOrgQuery.isSuccess) return <Loading />

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
              className={`${width} !absolute -top-10 z-10 w-max rounded-lg bg-white shadow-lg`}
            >
              <div className="flex items-center px-2">
                {dropdownSelectedOrg && (
                  <>
                    <div
                      className={`flex-shrink-0 cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-black	transition-colors duration-100 hover:bg-neutral-100   ${
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
                  className="m-0 px-2 py-3 !text-sm focus:border-0 focus:ring-0"
                  onKeyDown={onInputKeyDown}
                  value={inputValue}
                  onValueChange={onInputValueChange}
                />
              </div>
              <hr />
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
                    <div className="flex items-center space-x-2 text-blue-600">
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

const Item = ({
  children,
  value,
  onSelect = () => {},
}: {
  children: React.ReactNode
  value: string
  onSelect?: () => void
}) => {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="py-4rounded-md flex h-10 cursor-pointer select-none items-center rounded-md p-2 transition-colors duration-100 first:mt-2 aria-selected:bg-neutral-100"
    >
      <div className="flex w-full max-w-full items-center justify-between space-x-2">
        {children}
      </div>
    </Command.Item>
  )
}

const Avatar = (props: { url: string }) => {
  const { url } = props
  return <img src={url} className="h-5 w-5 rounded-full" />
}

const Text = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-900">
      {children}
    </span>
  )
}

const Left = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="flex items-center space-x-2 overflow-hidden">
      {children}
    </span>
  )
}

const Badge = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="inline-flex space-x-2 overflow-hidden text-xs text-gray-500">
      <span className="rounded-full border border-gray-200 bg-gray-100 px-2">
        {children}
      </span>
    </p>
  )
}

const Icon = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex-0 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center">
      {children}
    </div>
  )
}

const SelectedOrgRepo = ({
  org,
  repo,
  onClick,
}: {
  org: OrganizationRead
  repo: RepositoryRead | undefined
  onClick: () => void
}) => {
  return (
    <SelectedBox onClick={onClick}>
      <div className="flex items-center justify-between space-x-2 ">
        <img
          src={org.avatar_url}
          alt=""
          className="h-6 w-6 flex-shrink-0 rounded-full"
        />
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="flex-shrink-0 font-medium text-gray-900">
            {org.name}
          </span>

          {repo && (
            <>
              <span className="text-gray-400">/</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-gray-900">
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
        <img
          src={user.avatar_url}
          alt=""
          className="h-6 w-6 flex-shrink-0 rounded-full"
        />
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="flex-shrink-0 font-medium text-gray-900">
            {user.username}
          </span>
        </div>
      </div>
    </SelectedBox>
  )
}

const SelectedBox = ({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactElement
}) => {
  return (
    <div
      className="flex max-w-[360px] cursor-pointer items-center justify-between space-x-2 
      rounded-lg p-2
      text-sm hover:bg-neutral-100"
      onClick={onClick}
    >
      {children}
      <ChevronUpDownIcon className="h-6 w-6 flex-shrink-0 text-gray-500" />
    </div>
  )
}

const Loading = () => {
  return (
    <div className="h-8 w-40 flex-shrink-0 animate-pulse rounded-md bg-gray-100"></div>
  )
}
