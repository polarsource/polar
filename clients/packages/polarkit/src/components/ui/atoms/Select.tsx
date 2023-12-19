'use client'

import * as React from 'react'

import { Trigger as SelectTriggerBase } from '@radix-ui/react-select'
import { twMerge } from 'tailwind-merge'
import {
  SelectContent as SelectContentPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectLabel as SelectLabelPrimitive,
  Select as SelectPrimitive,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from '../select'

const Select = SelectPrimitive

const SelectGroup = SelectGroupPrimitive

const SelectValue = SelectValuePrimitive

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectTriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof SelectTriggerPrimitive>
>(({ className, children, ...props }, ref) => (
  <SelectTriggerPrimitive
    ref={ref}
    className={twMerge(
      'dark:border-polar-600 dark:placeholder:text-polar-500 dark:bg-polar-800 rounded-lg border-gray-200 bg-white p-3 text-sm shadow-sm outline-none focus:z-10 focus:border-blue-300 focus:ring-[3px] focus:ring-blue-100 focus-visible:ring-blue-100 dark:ring-offset-transparent dark:focus:border-blue-600 dark:focus:ring-blue-700/40',
      className,
    )}
    {...props}
  >
    {children}
  </SelectTriggerPrimitive>
))
SelectTrigger.displayName = SelectTriggerPrimitive.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof SelectContentPrimitive>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectContentPrimitive
    ref={ref}
    className={twMerge(
      'dark:bg-polar-800 dark:border-polar-600 rounded-lg bg-white shadow-lg',
      className,
    )}
    {...props}
  >
    {children}
  </SelectContentPrimitive>
))
SelectContent.displayName = SelectContentPrimitive.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectLabelPrimitive>,
  React.ComponentPropsWithoutRef<typeof SelectLabelPrimitive>
>(({ className, ...props }, ref) => (
  <SelectLabelPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectLabelPrimitive.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectItemPrimitive>,
  React.ComponentPropsWithoutRef<typeof SelectItemPrimitive>
>(({ className, children, ...props }, ref) => (
  <SelectItemPrimitive
    ref={ref}
    className={twMerge('focus:text-white', className)}
    {...props}
  >
    {children}
  </SelectItemPrimitive>
))
SelectItem.displayName = SelectItemPrimitive.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectSeparatorPrimitive>,
  React.ComponentPropsWithoutRef<typeof SelectSeparatorPrimitive>
>(({ className, ...props }, ref) => (
  <SelectSeparatorPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectSeparatorPrimitive.displayName

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectTriggerBase,
  SelectValue,
}
