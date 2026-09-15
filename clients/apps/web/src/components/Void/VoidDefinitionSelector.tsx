'use client'

import GraphicEqOutlined from '@mui/icons-material/GraphicEqOutlined'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { Status } from '@polar-sh/orbit'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@polar-sh/ui/components/atoms/Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useState } from 'react'
import { DEFINITIONS, VoidDefinition } from './fixtures'

const STATUS_COLOR: Record<
  VoidDefinition['status'],
  'green' | 'blue' | 'gray'
> = { Active: 'green', Draft: 'blue', Superseded: 'gray' }

export const VoidDefinitionSelector = () => {
  const [selected, setSelected] = useState<VoidDefinition>(DEFINITIONS[0])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip="Definition"
              className="dark:bg-polar-900 dark:border-polar-800 gap-x-4 border border-gray-200 bg-white shadow-xs"
            >
              <span className="dark:text-polar-500 flex shrink-0 items-center text-[15px] text-gray-500">
                <GraphicEqOutlined fontSize="inherit" />
              </span>
              <span className="flex items-center gap-2 truncate text-sm">
                <span className="truncate">{selected.name}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{selected.version}</span>
              </span>

              <KeyboardArrowDown className="ml-auto" fontSize="inherit" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="w-(--radix-popper-anchor-width) min-w-[220px]"
          >
            {DEFINITIONS.map((definition) => (
              <DropdownMenuItem
                key={definition.id}
                className="dark:hover:bg-polar-800! flex flex-row items-center gap-x-2 duration-75 hover:bg-gray-100! hover:text-black! dark:hover:text-white!"
                onClick={() => setSelected(definition)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{definition.name}</span>
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    {definition.version}
                  </span>
                </span>
                <span className="ml-auto">
                  <Status
                    status={definition.status}
                    color={STATUS_COLOR[definition.status]}
                    size="small"
                  />
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
