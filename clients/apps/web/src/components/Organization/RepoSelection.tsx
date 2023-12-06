'use client'

import { Repository } from '@polar-sh/sdk'
import { Command } from 'cmdk'
import { useOutsideClick } from 'polarkit/utils'
import React, { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Item, Left, SelectedBox, Text } from '../Dropdown'

export function RepoSelection(props: {
  onSelectRepo: (repo: string) => void
  onSelectAll: () => void
  repositories: Repository[]
  value: Repository | undefined
  selectedClassNames: string
  openClassNames: string
}) {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)

  const [open, setOpen] = React.useState(false)

  useEffect(() => {
    inputRef?.current?.focus()
  }, [])

  const { repositories } = props

  const resetDropdown = () => {
    setOpen(false)
    setInputValue('')
  }

  const onSelectRepo = (repo: Repository) => {
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
                width,
                props.openClassNames,
                'dark:bg-polar-800 dark:border-polar-700 !absolute z-10 w-max rounded-lg bg-white shadow-lg dark:border',
              )}
            >
              <div className="flex items-center px-2">
                <Command.Input
                  ref={inputRef}
                  autoFocus
                  placeholder={'Select a repository'}
                  className="dark:!text-polar-200 dark:placeholder:text-polar-400 m-0 px-2 py-3 !text-sm !text-gray-900 focus:border-0 focus:ring-0"
                  value={inputValue}
                  onValueChange={onInputValueChange}
                />
              </div>
              <hr className="dark:border-polar-700" />
              <Command.List
                ref={listRef}
                className="max-h-[500px] overflow-auto overscroll-contain px-2 pb-2"
              >
                <Command.Empty className="p dark:text-polar-400 !h-auto !justify-start !p-2 !pt-3">
                  No results found.
                </Command.Empty>

                <Item value="all repositories" onSelect={() => onSelectAll()}>
                  <Left>
                    <Text>All repositories</Text>
                  </Left>
                </Item>

                {sortedRepositories &&
                  sortedRepositories.map((r) => (
                    <Item
                      value={`${r.name}`}
                      key={r.id}
                      onSelect={() => onSelectRepo(r)}
                    >
                      <Left>
                        <Text>{r.name}</Text>
                      </Left>
                    </Item>
                  ))}
              </Command.List>
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
}: {
  repository: Repository
  onClick: () => void
  classNames: string
}) => {
  return (
    <SelectedBox onClick={onClick} classNames={classNames}>
      <div className="flex items-center justify-between space-x-2">
        <RepoIcon />
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="dark:text-polar-200 overflow-hidden text-ellipsis whitespace-nowrap text-gray-900">
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
