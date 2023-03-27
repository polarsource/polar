import {
  CodeBracketIcon as CodeBracketIconSmall,
  PlusIcon,
} from '@heroicons/react/20/solid'
import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Command } from 'cmdk'
import { useRouter } from 'next/router'
import { CONFIG } from 'polarkit'
import { OrganizationRead, RepositoryRead } from 'polarkit/api/client'
import { requireAuth, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import React, { useEffect, useState } from 'react'
import useOutsideClick from 'utils/useOutsideClick'

export function RepoSelection() {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)
  const router = useRouter()

  const [open, setOpen] = React.useState(false)

  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser?.id)

  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)
  const setCurrentOrgRepo = useStore((state) => state.setCurrentOrgRepo)

  useEffect(() => {
    inputRef?.current?.focus()
  }, [])

  const organizations = userOrgQuery.data

  // detect current from url
  useEffect(() => {
    if (!organizations) {
      return
    }

    const parts = location.pathname.replace('/dashboard/', '').split('/')
    let [orgName, repoName] = parts

    if (!orgName && !repoName) {
      if (!currentOrg) {
        let defaultOrg = organizations[0]
        setCurrentOrgRepo(defaultOrg, defaultOrg.repositories[0])
      }
      return
    }

    let org: OrganizationRead | undefined
    let repo: RepositoryRead | undefined

    // Find org
    const orgs = organizations.filter((o) => o.name === orgName)
    if (orgs.length === 0) {
      return
    }
    org = orgs[0]

    // Find repo
    if (repoName && org) {
      // from org find repo
      const repos = org.repositories.filter((r) => r.name === repoName)
      if (repos.length >= 0) {
        repo = repos[0]
      }
    }

    setCurrentOrgRepo(org, repo)
  }, [organizations])

  const [dropdownSelectedOrg, setDropdowndropdownSelectedOrg] = useState<
    OrganizationRead | undefined
  >()

  const resetDropdown = () => {
    setOpen(false)
    setDropdowndropdownSelectedOrg(undefined)
    setInputValue('')
  }

  const onSelectOrg = (org: OrganizationRead) => {
    // Select org again, go to it!
    if (dropdownSelectedOrg && dropdownSelectedOrg.id === org.id) {
      setCurrentOrgRepo(org, undefined)
      resetDropdown()
      router.push(`/dashboard/${org.name}`)
      return
    }

    setDropdowndropdownSelectedOrg(org)
    setInputValue('')
  }

  const onSelectRepo = (org: OrganizationRead, repo: RepositoryRead) => {
    if (org && repo) {
      setCurrentOrgRepo(org, repo)
      resetDropdown()
      router.push(`/dashboard/${org.name}/${repo.name}`)
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

  const [listOrgs, setListOrgs] = useState<OrganizationRead[]>()

  // Value in <input>
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    let orgs = []

    // No selected org, and no search: show only orgs
    if (dropdownSelectedOrg === undefined && inputValue === '') {
      orgs =
        organizations?.map((o) => {
          return {
            ...o,
            repositories: [],
          }
        }) || []
    } else if (dropdownSelectedOrg === undefined) {
      orgs = organizations
    } else if (dropdownSelectedOrg) {
      // selected org
      orgs = organizations?.filter((o) => o.id === dropdownSelectedOrg.id) || []
    } else {
      orgs = []
    }

    setListOrgs(orgs)
  }, [dropdownSelectedOrg, organizations, inputValue])

  const onInputValueChange = (e) => {
    setValue(e)
    setInputValue(e)
  }

  const outsideClickRef = useOutsideClick(() => {
    setOpen(false)
  })

  // TODO: return better styling...
  if (!currentUser) {
    return <div>Not authenticated</div>
  }
  if (userOrgQuery.isLoading) return <div>Loading...</div>
  if (!userOrgQuery.isSuccess) return <div>Error</div>

  if (!currentOrg) return null

  return (
    <div
      ref={outsideClickRef}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      <TopbarOrgRepo
        org={currentOrg}
        repo={currentRepo}
        onClick={() => setOpen(true)}
      />
      {open && (
        <>
          <div>
            <Command
              value={value}
              onValueChange={onValueChange}
              className="!absolute top-3  w-full max-w-[350px] rounded-md border-[1px] border-neutral-100 bg-white shadow-xl"
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
                  placeholder="Search orgs and repos..."
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
                    {org.repositories.map((r) => (
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

function TopbarOrgRepo({
  org,
  repo,
  onClick,
}: {
  org: OrganizationRead
  repo: RepositoryRead | undefined
  onClick: () => void
}) {
  return (
    <div
      className="flex max-w-[350px] cursor-pointer items-center space-x-2 rounded-md 
      p-2 text-sm
      hover:bg-neutral-100"
      onClick={onClick}
    >
      <img
        src={org.avatar_url}
        alt=""
        className="h-6 w-6 flex-shrink-0 rounded-full"
      />
      <div className="flex items-center space-x-1 overflow-hidden ">
        <span className="flex-shrink-0 font-medium text-black">{org.name}</span>

        {repo && (
          <>
            <span className="text-black/20">/</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-black/50">
              {repo.name}
            </span>
          </>
        )}
      </div>
      <ChevronUpDownIcon className="h-6 w-6 flex-shrink-0 text-black/50" />
    </div>
  )
}
