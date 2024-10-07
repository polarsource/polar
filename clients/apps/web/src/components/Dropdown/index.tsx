import { ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { Command } from 'cmdk'
import React from 'react'
import { twMerge } from 'tailwind-merge'

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
      className="dark:aria-selected:bg-polar-600 flex h-10 cursor-pointer select-none items-center rounded-md p-2 py-4 transition-colors duration-100 first:mt-2 aria-selected:bg-gray-100"
    >
      <div className="flex w-full max-w-full items-center justify-between space-x-2">
        {children}
      </div>
    </Command.Item>
  )
}

export const Text = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="dark:text-polar-200 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-900">
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
    <p className="inline-flex space-x-2 overflow-hidden text-xs text-gray-500 dark:text-white">
      <span className="dark:bg-polar-500 dark:border-polar-400/50 rounded-full border border-gray-200 bg-gray-100 px-2">
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
      className={twMerge(
        'dark:hover:bg-polar-700 dark:border-polar-800 dark:bg-polar-800 flex cursor-pointer items-center justify-between space-x-2 rounded-lg border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50',
        classNames,
      )}
      onClick={onClick}
    >
      {children}
      <ChevronUpDownIcon className="dark:text-polar-300 h-6 w-6 flex-shrink-0 text-gray-500" />
    </div>
  )
}

export const Loading = () => {
  return (
    <div className="h-8 w-40 flex-shrink-0 animate-pulse rounded-md bg-gray-100"></div>
  )
}
