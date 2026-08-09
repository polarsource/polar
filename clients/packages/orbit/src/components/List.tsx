'use client'

import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { selectionRevealClassName } from '../lib/selectionReveal'
import { Checkbox } from './Checkbox'

export interface ListProps extends PropsWithChildren {
  className?: string
  size?: 'small' | 'default'
}

export const List = ({ children, className, size = 'default' }: ListProps) => {
  return children ? (
    <div
      className={twMerge(
        'dark:divide-polar-700 dark:border-polar-700 flex flex-col divide-y divide-gray-200 overflow-hidden border border-gray-200',
        size === 'default' ? 'rounded-4xl' : 'rounded-2xl',
        className,
      )}
    >
      {children}
    </div>
  ) : null
}

export interface ListItemProps extends PropsWithChildren {
  className?: string
  inactiveClassName?: string
  selectedClassName?: string
  children: React.ReactNode
  selected?: boolean
  onSelect?: (e: React.MouseEvent) => void
  size?: 'small' | 'default'
  selectable?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean, event: React.MouseEvent) => void
  checkboxVisible?: boolean
}

export const ListItem = ({
  className,
  inactiveClassName,
  selectedClassName,
  children,
  selected,
  onSelect,
  size = 'default',
  selectable,
  checked,
  onCheckedChange,
  checkboxVisible,
}: ListItemProps) => {
  return (
    <div
      className={twMerge(
        'group/row flex flex-row items-center justify-between gap-x-6',
        selected
          ? 'dark:bg-polar-800 bg-gray-50'
          : 'dark:hover:bg-polar-800 hover:bg-gray-50',
        selected ? selectedClassName : inactiveClassName,
        onSelect && 'cursor-pointer',
        size === 'default' ? 'px-6 py-4' : 'px-4 py-2',
        className,
      )}
      onClick={onSelect}
    >
      {selectable && (
        <div
          className="-my-2 -mr-5 -ml-4 flex cursor-pointer items-center p-2"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onCheckedChange?.(!checked, event)
          }}
        >
          <Checkbox
            aria-label="Select item"
            checked={checked}
            className={selectionRevealClassName(!!checkboxVisible)}
          />
        </div>
      )}
      {children}
    </div>
  )
}
