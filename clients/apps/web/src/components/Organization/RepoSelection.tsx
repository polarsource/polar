import { Command } from 'cmdk'
import {
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { useOutsideClick } from 'polarkit/utils'
import React, { useEffect, useRef, useState } from 'react'
import { Item, Left, SelectedBox, Text } from '../Dropdown'

export function RepoSelection(props: {
  onSelectRepo: (org: string, repo: string) => void
  organization: OrganizationPublicRead
  repositories: RepositoryPublicRead[]
  value: RepositoryPublicRead | undefined
}) {
  const [value, setValue] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const listRef = React.useRef(null)

  const [open, setOpen] = React.useState(false)

  useEffect(() => {
    inputRef?.current?.focus()
  }, [])

  const { organization, repositories } = props

  const resetDropdown = () => {
    setOpen(false)
    //setDropdowndropdownSelectedOrg(undefined)
    setInputValue('')
  }

  const onSelectRepo = (
    org: OrganizationPublicRead,
    repo: RepositoryPublicRead,
  ) => {
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

  const width = 'min-w-[320px] max-w-[500px]'

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      {props.value && (
        <SelectedRepository
          repository={props.value}
          onClick={() => setOpen(true)}
        />
      )}
      {!props.value && <SelectedEmpty onClick={() => setOpen(true)} />}
      {open && (
        <>
          <div className={`relative bg-red-200`}>
            <Command
              value={value}
              onValueChange={onValueChange}
              className={`${width} !absolute -top-10 z-10 w-max rounded-lg bg-white shadow-lg dark:border dark:border-gray-600 dark:bg-gray-700`}
            >
              <div className="flex items-center px-2">
                <Command.Input
                  ref={inputRef}
                  autoFocus
                  placeholder={'Select a repository'}
                  className="m-0 px-2 py-3 !text-sm !text-gray-900 focus:border-0 focus:ring-0 dark:!text-gray-200"
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

                {repositories &&
                  repositories.map((r) => (
                    <Item
                      value={`${organization.name}/${r.name}`}
                      key={r.id}
                      onSelect={() => onSelectRepo(organization, r)}
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
}: {
  repository: RepositoryPublicRead
  onClick: () => void
}) => {
  return (
    <SelectedBox onClick={onClick}>
      <div className="flex items-center justify-between space-x-2 ">
        <div className="flex items-center space-x-1 overflow-hidden ">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-gray-900 dark:text-gray-200">
            {repository.name}
          </span>
        </div>
      </div>
    </SelectedBox>
  )
}

const SelectedEmpty = ({ onClick }: { onClick: () => void }) => {
  return (
    <SelectedBox onClick={onClick}>
      <div className="text-gray-500">All repositories</div>
    </SelectedBox>
  )
}
