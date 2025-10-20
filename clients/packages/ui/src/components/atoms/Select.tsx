'use client'

import * as React from 'react'

import {
  SelectContent as SelectContentPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectLabel as SelectLabelPrimitive,
  Select as SelectPrimitive,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
} from '@/components/ui/select'
import { Trigger as SelectTriggerBase } from '@radix-ui/react-select'
import { twMerge } from 'tailwind-merge'

const Select = SelectPrimitive

const SelectGroup = SelectGroupPrimitive

const SelectValue = SelectValuePrimitive

const SelectTrigger = ({
  ref,
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectTriggerPrimitive>) => (
  <SelectTriggerPrimitive
    ref={ref}
    className={twMerge(
      'dark:bg-polar-800 dark:hover:bg-polar-700 dark:border-polar-700 flex flex-row gap-x-2 rounded-xl border border-gray-200 bg-white px-3 shadow-xs transition-colors hover:bg-gray-50',
      className,
    )}
    {...props}
  >
    {children}
  </SelectTriggerPrimitive>
)
SelectTrigger.displayName = SelectTriggerPrimitive.displayName

const SelectContent = ({
  ref,
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectContentPrimitive>) => (
  <SelectContentPrimitive
    ref={ref}
    className={twMerge('dark:bg-polar-800 rounded-xl border-none', className)}
    {...props}
  >
    {children}
  </SelectContentPrimitive>
)
SelectContent.displayName = SelectContentPrimitive.displayName

const SelectLabel = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof SelectLabelPrimitive>) => (
  <SelectLabelPrimitive ref={ref} className={className} {...props} />
)
SelectLabel.displayName = SelectLabelPrimitive.displayName

const SelectItem = ({
  ref,
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectItemPrimitive>) => (
  <SelectItemPrimitive
    ref={ref}
    className={twMerge(className, 'rounded-lg')}
    {...props}
  >
    {children}
  </SelectItemPrimitive>
)
SelectItem.displayName = SelectItemPrimitive.displayName

const SelectSeparator = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof SelectSeparatorPrimitive>) => (
  <SelectSeparatorPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
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
