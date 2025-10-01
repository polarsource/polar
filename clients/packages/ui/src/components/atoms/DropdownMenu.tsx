'use client'

import {
  DropdownMenuContent as DropdownMenuContentPrimitive,
  DropdownMenuItem as DropdownMenuItemPrimitive,
  DropdownMenuPortal as DropdownMenuPortalPrimitive,
  DropdownMenu as DropdownMenuPrimitive,
  DropdownMenuSeparator as DropdownMenuSeparatorPrimitive,
  DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
} from '@/components/ui/dropdown-menu'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'

const DropdownMenu = DropdownMenuPrimitive
const DropdownMenuPortal = DropdownMenuPortalPrimitive
const DropdownMenuTrigger = DropdownMenuTriggerPrimitive

const DropdownMenuContent = ({
  ref,
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuContentPrimitive>) => (
  <DropdownMenuPortal>
    <DropdownMenuContentPrimitive
      ref={ref}
      sideOffset={sideOffset}
      className={twMerge('', className)}
      {...props}
    />
  </DropdownMenuPortal>
)
DropdownMenuContent.displayName = DropdownMenuContentPrimitive.displayName

const DropdownMenuItem = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuItemPrimitive>) => (
  <DropdownMenuItemPrimitive
    ref={ref}
    className={twMerge(props?.onClick ? 'cursor-pointer' : '', className)}
    {...props}
  />
)
DropdownMenuItem.displayName = DropdownMenuItemPrimitive.displayName

const DropdownMenuSeparator = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparatorPrimitive>) => (
  <DropdownMenuSeparatorPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
DropdownMenuSeparator.displayName = DropdownMenuSeparatorPrimitive.displayName

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
