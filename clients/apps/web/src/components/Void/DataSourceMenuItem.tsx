'use client'

import { DropdownMenuItem } from '@polar-sh/ui/components/ui/dropdown-menu'
import { setVoidDataSource, useVoidDataSource } from './dataSource'

/** Flips the Void dashboard between the in-repo fixtures and the live API. */
export const DataSourceMenuItem = () => {
  const live = useVoidDataSource() === 'live'
  return (
    <DropdownMenuItem
      className="dark:hover:bg-polar-800! flex flex-row items-center gap-x-2 duration-75 hover:bg-gray-100! hover:text-black! dark:hover:text-white!"
      onClick={() => setVoidDataSource(live ? 'fixtures' : 'live')}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          {live ? 'Switch to fixture data' : 'Switch to live data'}
        </span>
        <span className="dark:text-polar-500 text-xs text-gray-500">
          {live ? 'Reading from the Void API' : 'Reading from fixtures'}
        </span>
      </span>
    </DropdownMenuItem>
  )
}
