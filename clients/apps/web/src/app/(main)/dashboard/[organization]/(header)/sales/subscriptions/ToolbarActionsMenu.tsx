'use client'

import { Button } from '@polar-sh/orbit'
import { EllipsisVertical } from '@polar-sh/orbit/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { Fragment, type ReactNode } from 'react'

// Matches the filter menu beside it.
const CONTENT_CLASS =
  'dark:bg-polar-800 dark:border-polar-700 w-56 rounded-xl border border-gray-200 bg-white p-1.5 text-[13px] shadow-xl'
const ITEM_CLASS =
  'dark:focus:bg-polar-700 h-7 gap-3 rounded-md px-2 text-[13px] text-black focus:bg-gray-100 focus:text-black dark:text-white dark:focus:text-white [&_svg]:size-3.5!'
const ICON_CLASS = 'dark:text-polar-400 flex shrink-0 text-gray-500'
const SEPARATOR_CLASS = 'dark:bg-polar-700 -mx-1.5 my-1.5 bg-gray-200'

export interface ToolbarAction {
  key: string
  label: string
  icon: ReactNode
  onSelect: () => void
}

// Actions on the view as a whole, in groups divided by a line.
export const ToolbarActionsMenu = ({
  groups,
}: {
  groups: ToolbarAction[][]
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        size="icon"
        variant="ghost"
        className="dark:data-[state=open]:bg-polar-700 h-7 w-7 data-[state=open]:bg-gray-200 [&_svg]:size-4!"
        aria-label="More actions"
        title="More actions"
      >
        <EllipsisVertical />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className={CONTENT_CLASS}>
      {groups
        .filter((group) => group.length > 0)
        .map((group, index) => (
          <Fragment key={group[0].key}>
            {index > 0 && <DropdownMenuSeparator className={SEPARATOR_CLASS} />}
            {group.map(({ key, label, icon, onSelect }) => (
              <DropdownMenuItem
                key={key}
                className={ITEM_CLASS}
                onSelect={onSelect}
              >
                <span className={ICON_CLASS}>{icon}</span>
                {label}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
    </DropdownMenuContent>
  </DropdownMenu>
)
