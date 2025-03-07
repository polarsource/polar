'use client'

import { useOutsideClick } from '@/utils/useOutsideClick'
import { schemas } from '@polar-sh/client'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@polar-sh/ui/components/ui/command'
import { ChevronDown } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export const SelectedBox = ({
  onClick,
  children,
  classNames,
}: {
  onClick: () => void
  children: React.ReactElement
  classNames: string
}) => {
  return (
    <div
      className={twMerge(
        'dark:hover:bg-polar-700 dark:border-polar-700 dark:bg-polar-800 flex cursor-pointer items-center justify-between space-x-2 rounded-lg border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50',
        classNames,
      )}
      onClick={onClick}
    >
      {children}
      <ChevronDown className="dark:text-polar-300 h-4 w-4 flex-shrink-0 text-gray-500" />
    </div>
  )
}

export function RepoSelection(props: {
  onSelectRepo: (repo: string) => void
  onSelectAll: () => void
  repositories: schemas['Repository'][]
  value: schemas['Repository'] | undefined
  selectedClassNames: string
  openClassNames: string
}) {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)

  const hasSeveralOrganizations = useMemo(
    () => new Set(props.repositories.map((r) => r.organization.id)).size > 1,
    [props.repositories],
  )

  const [open, setOpen] = React.useState(false)

  useEffect(() => {
    inputRef?.current?.focus()
  }, [])

  const { repositories } = props

  const resetDropdown = () => {
    setOpen(false)
    setInputValue('')
  }

  const onSelectRepo = (repo: schemas['Repository']) => {
    resetDropdown()
    props.onSelectRepo(repo.name)
  }

  const onSelectAll = () => {
    resetDropdown()
    props.onSelectAll()
  }

  const onValueChange = (search: string) => {
    setValue(search)
  }

  // Value in <input>
  const [inputValue, setInputValue] = useState('')

  const onInputValueChange = (e: string) => {
    setValue(e)
    setInputValue(e)
  }

  const ref = useRef(null)

  useOutsideClick([ref], () => {
    setOpen(false)
  })

  const width = 'lg:min-w-[320px] lg:max-w-[500px]'

  const sortedRepositories = repositories.sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
      }}
      className="h-full w-full lg:w-fit"
    >
      {props.value && (
        <SelectedRepository
          classNames={props.selectedClassNames}
          repository={props.value}
          onClick={() => setOpen(true)}
          displayOrganization={hasSeveralOrganizations}
        />
      )}
      {!props.value && (
        <SelectedEmpty
          classNames={props.selectedClassNames}
          onClick={() => setOpen(true)}
        />
      )}
      {open && (
        <>
          <div className="relative">
            <Command
              value={value}
              onValueChange={onValueChange}
              className={twMerge(
                props.openClassNames,
                width,
                '!absolute z-[100] h-64 w-max',
              )}
            >
              <CommandInput
                ref={inputRef}
                autoFocus
                placeholder={'Select a repository'}
                value={inputValue}
                onValueChange={onInputValueChange}
              />
              <CommandList
                ref={listRef}
                className="max-h-[500px] overflow-auto overscroll-contain px-2 pb-2"
              >
                <CommandEmpty className="p dark:text-polar-400 !h-auto !justify-start !p-2 !pt-3">
                  No results found.
                </CommandEmpty>

                <CommandItem
                  value="all repositories"
                  onSelect={() => onSelectAll()}
                >
                  All repositories
                </CommandItem>

                {sortedRepositories &&
                  sortedRepositories.map((r) => (
                    <CommandItem
                      value={`${hasSeveralOrganizations ? `${r.organization.name}/` : ''}${r.name}`}
                      key={r.id}
                      onSelect={() => onSelectRepo(r)}
                    >
                      {hasSeveralOrganizations && `${r.organization.name}/`}
                      {r.name}
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          </div>
        </>
      )}
    </div>
  )
}

export default RepoSelection

const SelectedRepository = ({
  repository,
  onClick,
  classNames,
  displayOrganization,
}: {
  repository: schemas['Repository']
  onClick: () => void
  classNames: string
  displayOrganization?: boolean
}) => {
  return (
    <SelectedBox onClick={onClick} classNames={classNames}>
      <div className="flex items-center justify-between space-x-2">
        <RepoIcon />
        <div className="flex items-center space-x-1 overflow-hidden">
          <span className="dark:text-polar-200 overflow-hidden text-ellipsis whitespace-nowrap text-gray-900">
            {displayOrganization && `${repository.organization.name}/`}
            {repository.name}
          </span>
        </div>
      </div>
    </SelectedBox>
  )
}

const SelectedEmpty = ({
  onClick,
  classNames,
}: {
  onClick: () => void
  classNames: string
}) => {
  return (
    <SelectedBox onClick={onClick} classNames={classNames}>
      <div className="dark:text-polar-300 flex items-center gap-2 text-gray-500">
        <RepoIcon />
        <span>All repositories</span>
      </div>
    </SelectedBox>
  )
}

const RepoIcon = () => {
  return (
    <svg
      className="dark:text-polar-500 text-gray-400"
      width="17"
      height="18"
      viewBox="0 0 17 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.75 14.5208C2.75 14.0512 2.93931 13.6008 3.27629 13.2687C3.61327 12.9366 4.07031 12.75 4.54688 12.75H14.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.54688 1.75H14.25V16.25H4.54688C4.07031 16.25 3.61327 16.059 3.27629 15.7191C2.93931 15.3792 2.75 14.9182 2.75 14.4375V3.5625C2.75 3.0818 2.93931 2.62078 3.27629 2.28087C3.61327 1.94096 4.07031 1.75 4.54688 1.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
