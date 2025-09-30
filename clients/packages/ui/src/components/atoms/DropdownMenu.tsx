'use client'

import {
  DropdownMenuCheckboxItem as DropdownMenuCheckboxItemPrimitive,
  DropdownMenuContent as DropdownMenuContentPrimitive,
  DropdownMenuGroup as DropdownMenuGroupPrimitive,
  DropdownMenuItem as DropdownMenuItemPrimitive,
  DropdownMenuLabel as DropdownMenuLabelPrimitive,
  DropdownMenuPortal as DropdownMenuPortalPrimitive,
  DropdownMenu as DropdownMenuPrimitive,
  DropdownMenuRadioGroup as DropdownMenuRadioGroupPrimitive,
  DropdownMenuRadioItem as DropdownMenuRadioItemPrimitive,
  DropdownMenuSeparator as DropdownMenuSeparatorPrimitive,
  DropdownMenuSubContent as DropdownMenuSubContentPrimitive,
  DropdownMenuSub as DropdownMenuSubPrimitive,
  DropdownMenuSubTrigger as DropdownMenuSubTriggerPrimitive,
  DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
} from '@/components/ui/dropdown-menu'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'

const DropdownMenu = DropdownMenuPrimitive

const DropdownMenuTrigger = DropdownMenuTriggerPrimitive

const DropdownMenuGroup = DropdownMenuGroupPrimitive

const DropdownMenuPortal = DropdownMenuPortalPrimitive

const DropdownMenuSub = DropdownMenuSubPrimitive

const DropdownMenuRadioGroup = DropdownMenuRadioGroupPrimitive

const DropdownMenuSubTrigger = ({
  ref,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuSubTriggerPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuSubTriggerPrimitive>>
}) => (
  <DropdownMenuSubTriggerPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  >
    {children}
  </DropdownMenuSubTriggerPrimitive>
)
DropdownMenuSubTrigger.displayName = DropdownMenuSubTriggerPrimitive.displayName

const DropdownMenuSubContent = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuSubContentPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuSubContentPrimitive>>
}) => (
  <DropdownMenuSubContentPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
DropdownMenuSubContent.displayName = DropdownMenuSubContentPrimitive.displayName

const DropdownMenuContent = ({
  ref,
  className,
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuContentPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuContentPrimitive>>
}) => (
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
}: React.ComponentPropsWithoutRef<typeof DropdownMenuItemPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuItemPrimitive>>
}) => (
  <DropdownMenuItemPrimitive
    ref={ref}
    className={twMerge(props?.onClick ? 'cursor-pointer' : '', className)}
    {...props}
  />
)
DropdownMenuItem.displayName = DropdownMenuItemPrimitive.displayName

const DropdownMenuCheckboxItem = ({
  ref,
  className,
  children,
  checked,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuCheckboxItemPrimitive> & {
  ref: React.RefObject<
    React.ElementRef<typeof DropdownMenuCheckboxItemPrimitive>
  >
}) => (
  <DropdownMenuCheckboxItemPrimitive
    ref={ref}
    className={twMerge('', className)}
    checked={checked}
    {...props}
  >
    {children}
  </DropdownMenuCheckboxItemPrimitive>
)
DropdownMenuCheckboxItem.displayName =
  DropdownMenuCheckboxItemPrimitive.displayName

const DropdownMenuRadioItem = ({
  ref,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuRadioItemPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuRadioItemPrimitive>>
}) => (
  <DropdownMenuRadioItemPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  >
    {children}
  </DropdownMenuRadioItemPrimitive>
)
DropdownMenuRadioItem.displayName = DropdownMenuRadioItemPrimitive.displayName

const DropdownMenuLabel = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuLabelPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuLabelPrimitive>>
}) => (
  <DropdownMenuLabelPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
DropdownMenuLabel.displayName = DropdownMenuLabelPrimitive.displayName

const DropdownMenuSeparator = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuSeparatorPrimitive> & {
  ref: React.RefObject<React.ElementRef<typeof DropdownMenuSeparatorPrimitive>>
}) => (
  <DropdownMenuSeparatorPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
DropdownMenuSeparator.displayName = DropdownMenuSeparatorPrimitive.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={twMerge('', className)} {...props} />
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
