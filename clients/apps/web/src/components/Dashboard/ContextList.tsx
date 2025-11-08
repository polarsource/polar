import { useInViewport } from '@/hooks/utils'
import AddOutlined from '@mui/icons-material/AddOutlined'
import Search from '@mui/icons-material/Search'
import Button, { ButtonProps } from '@polar-sh/ui/components/atoms/Button'
import Input, { InputProps } from '@polar-sh/ui/components/atoms/Input'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'

import type { JSX } from 'react'

export interface ContextListItemProps {
  id: string
  title: string
  subtitle: string
  active: boolean
  icon?: JSX.Element
}

export interface ContextListProps {
  title: string
  items: ContextListItemProps[]
  loading?: boolean
  cta?: Omit<ButtonProps, 'children'>
  search?: InputProps
  onSelect?: (id: string) => void
}

export const ContextList = ({
  title,
  items,
  loading,
  cta,
  search,
  onSelect,
}: ContextListProps) => {
  const { ref: loadingRef } = useInViewport()

  return (
    <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
      <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
        <div>{title}</div>
        <div className="flex flex-row items-center gap-4">
          <Button size="icon" className="h-6 w-6" {...cta}>
            <AddOutlined fontSize="small" />
          </Button>
        </div>
      </div>
      {search && (
        <div className="flex flex-row items-center gap-3 px-4 py-2">
          <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
            <Search
              fontSize="inherit"
              className="dark:text-polar-500 text-gray-500"
            />
          </div>
          <Input
            placeholder="Search"
            {...search}
            className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          />
        </div>
      )}
      <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            className={twMerge(
              'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
              item.active && 'dark:bg-polar-800 bg-gray-100',
            )}
          >
            <div className="flex flex-row items-center gap-3 px-4 py-3">
              {item.icon}
              <div className="flex min-w-0 flex-col">
                <div className="w-full truncate text-sm">{item.title}</div>
                <div className="dark:text-polar-500 w-full truncate text-xs text-gray-500">
                  {item.subtitle}
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div
            ref={loadingRef}
            className="flex w-full items-center justify-center py-8"
          >
            <Spinner />
          </div>
        )}
      </div>
    </div>
  )
}
