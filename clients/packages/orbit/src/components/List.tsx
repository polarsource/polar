'use client'

import React, { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
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
  checked?: boolean
  onCheckedChange?: (checked: boolean, event: React.MouseEvent) => void
  checkboxVisible?: boolean
  checkboxLabel?: string
}

export const ListItem = ({
  className,
  inactiveClassName,
  selectedClassName,
  children,
  selected,
  onSelect,
  size = 'default',
  checked,
  onCheckedChange,
  checkboxVisible,
  checkboxLabel = 'Select item',
}: ListItemProps) => {
  const hasCheckbox = !!onCheckedChange

  return (
    <div
      className={twMerge(
        'group/row flex flex-row items-center justify-between',
        selected
          ? 'dark:bg-polar-800 bg-gray-50'
          : 'dark:hover:bg-polar-800 hover:bg-gray-50',
        selected ? selectedClassName : inactiveClassName,
        onSelect && 'cursor-pointer',
        size === 'default' ? 'py-4' : 'py-2',
        hasCheckbox ? 'pr-6 pl-4' : size === 'default' ? 'px-6' : 'px-4',
        !hasCheckbox && 'gap-x-6',
        className,
      )}
      onClick={onSelect}
    >
      {onCheckedChange && (
        <div
          className="flex shrink-0 cursor-pointer items-center pr-4"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onCheckedChange(!checked, event)
          }}
        >
          <Checkbox
            aria-label={checkboxLabel}
            checked={checked}
            className={twMerge(
              'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 pointer-coarse:opacity-100',
              checkboxVisible && 'opacity-100',
            )}
          />
        </div>
      )}
      {children}
    </div>
  )
}
