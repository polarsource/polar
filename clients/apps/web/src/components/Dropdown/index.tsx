import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Command } from 'cmdk'
import Image from 'next/image'
import { clsx } from 'polarkit/utils'
import React from 'react'

export const Item = ({
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
      className="py-4rounded-md flex h-10 cursor-pointer select-none items-center rounded-md p-2 transition-colors duration-100 first:mt-2 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-600"
    >
      <div className="flex w-full max-w-full items-center justify-between space-x-2">
        {children}
      </div>
    </Command.Item>
  )
}

export const Avatar = (props: { url: string }) => {
  const { url } = props
  return (
    <Image
      src={url}
      alt="Avatar"
      height={200}
      width={200}
      className="h-5 w-5 rounded-full bg-white"
    />
  )
}

export const Text = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
      {children}
    </span>
  )
}

export const Left = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="flex items-center space-x-2 overflow-hidden">
      {children}
    </span>
  )
}

export const Badge = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="inline-flex space-x-2 overflow-hidden text-xs text-gray-500 dark:text-gray-50">
      <span className="rounded-full border border-gray-200 bg-gray-100 px-2 dark:border-gray-400/50 dark:bg-gray-500">
        {children}
      </span>
    </p>
  )
}

export const Icon = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex-0 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center">
      {children}
    </div>
  )
}

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
      className={clsx(
        'flex h-full cursor-pointer items-center justify-between space-x-2 p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
        classNames,
      )}
      onClick={onClick}
    >
      {children}
      <ChevronUpDownIcon className="h-6 w-6 flex-shrink-0 text-gray-500 dark:text-gray-400" />
    </div>
  )
}

export const Loading = () => {
  return (
    <div className="h-8 w-40 flex-shrink-0 animate-pulse rounded-md bg-gray-100"></div>
  )
}
