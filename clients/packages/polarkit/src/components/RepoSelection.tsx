import {
  CodeBracketIcon as CodeBracketIconSmall,
  PlusIcon,
} from '@heroicons/react/20/solid'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Command } from 'cmdk'
import React, { useEffect, useRef, useState } from 'react'
import { OrganizationRead, RepositoryRead } from '../api/client'
import { CONFIG } from '../config'
import { requireAuth, useUserOrganizations } from '../hooks'
import { useOutsideClick } from '../utils'

export function RepoSelection(props: {
  showRepositories?: boolean
  showConnectMore?: boolean
  onSelectRepo?: (org: string, repo: string) => void
  onSelectOrg?: (org: string) => void
  currentOrg?: OrganizationRead
  currentRepo?: RepositoryRead
  fullWidth?: boolean
}) {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)

  const [open, setOpen] = React.useState(false)

  const { currentUser } = requireAuth()
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

  const onValueChange = (search: string) => {
    setValue(search)
  }

  const [orgIsBackspaceHighlighted, setOrgIsBackspaceHighlighted] =
    useState(false)

  const onInputKeyUp = (e) => {
    // Backspace once to select, backspace again to delete
    if (e.code === 'Backspace' && e.target.value === '') {
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

  const [listOrgs, setListOrgs] = useState<OrganizationRead[]>([])

  // Value in <input>
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    let orgs: OrganizationRead[] = []

    // No selected org, and no search: show only orgs
    if (dropdownSelectedOrg === undefined && inputValue === '') {
      orgs =
        organizations?.map((o) => {
          return {
            ...o,
            repositories: [],
          }
        }) || []
    } else if (dropdownSelectedOrg === undefined && organizations) {
      orgs = organizations
    } else if (dropdownSelectedOrg) {
      // selected org
      orgs = organizations?.filter((o) => o.id === dropdownSelectedOrg.id) || []
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

  const width = props.fullWidth ? 'min-w-full' : 'w-max-[350px]'
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

      {!props.currentOrg && <SelectedEmpty onClick={() => setOpen(true)} />}

      {open && (
        <>
          <div className={`${width} relative w-min`}>
            <Command
              value={value}
              onValueChange={onValueChange}
              className={`${width} !absolute -top-10 z-10 w-max rounded-md border-[1px] border-neutral-100 bg-white shadow-xl`}
            >
              <div className="flex items-center space-x-1 px-2">
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
                    <div className="flex-shrink-0">/</div>
                  </>
                )}
                <Command.Input
                  ref={inputRef}
                  autoFocus
                  placeholder={placeholder}
                  className="m-0 px-2 focus:border-0 focus:ring-0"
                  onKeyDown={onInputKeyUp}
                  value={inputValue}
                  onValueChange={onInputValueChange}
                />
              </div>
              <hr />
              <Command.List
                ref={listRef}
                className="max-h-[500px] overflow-auto overscroll-contain px-2 pb-2"
              >
                <Command.Empty>No results found.</Command.Empty>

                {listOrgs.map((org) => (
                  <React.Fragment key={org.id}>
                    <Item
                      value={`${org.name}`}
                      onSelect={() => onSelectOrg(org)}
                    >
                      <Avatar url={org.avatar_url} />
                      <Text>{org.name}</Text>
                    </Item>
                    {org.repositories &&
                      org.repositories.map((r) => (
                        <Item
                          value={`${org.name}/${r.name}`}
                          key={r.id}
                          onSelect={() => onSelectRepo(org, r)}
                        >
                          <Icon>
                            <CodeBracketIconSmall className="block h-5 w-5 text-[#B2B2B2]" />
                          </Icon>

                          {dropdownSelectedOrg && <Text>{r.name}</Text>}

                          {!dropdownSelectedOrg && (
                            <Text>
                              {org.name} / {r.name}
                            </Text>
                          )}
                        </Item>
                      ))}
                  </React.Fragment>
                ))}

                {props.showConnectMore && (
                  <Item
                    value="Connect a repository"
                    onSelect={() => {
                      window.location.replace(CONFIG.GITHUB_INSTALLATION_URL)
                    }}
                  >
                    <div className="flex items-center space-x-2 text-purple-800">
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

function Item({
  children,
  value,
  onSelect = () => {},
}: {
  children: React.ReactNode
  value: string
  onSelect?: () => void
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="py-4rounded-md flex  h-10 cursor-pointer select-none items-center rounded-md p-2 transition-colors duration-100 first:mt-2 aria-selected:bg-neutral-100"
    >
      <div className="flex max-w-full items-center space-x-2">{children}</div>
    </Command.Item>
  )
}

function Avatar(props: { url: string }) {
  const { url } = props
  return <img src={url} className="h-6 w-6 rounded-full" />
}

function Text({ children }: { children: React.ReactNode }) {
  return (
    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-black">
      {children}
    </span>
  )
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-0 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center">
      {children}
    </div>
  )
}

function SelectedOrgRepo({
  org,
  repo,
  onClick,
}: {
  org: OrganizationRead
  repo: RepositoryRead | undefined
  onClick: () => void
}) {
  return (
    <SelectedBox onClick={onClick}>
      <div className="flex items-center justify-between space-x-2 ">
        <img
          src={org.avatar_url}
          alt=""
          className="h-6 w-6 flex-shrink-0 rounded-full"
        />
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="flex-shrink-0 font-medium text-black">
            {org.name}
          </span>

          {repo && (
            <>
              <span className="text-black/20">/</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-black/50">
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
      <div className="text-black/50">Select a organization</div>
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
      className="flex max-w-[350px] cursor-pointer items-center justify-between space-x-2 
      rounded-md p-2
      text-sm hover:bg-neutral-100"
      onClick={onClick}
    >
      {children}
      <ChevronUpDownIcon className="h-6 w-6 flex-shrink-0 text-black/50" />
    </div>
  )
}

const Loading = () => {
  return (
    <div className="h-8 w-40 flex-shrink-0 animate-pulse rounded-md bg-gray-100"></div>
  )
}
