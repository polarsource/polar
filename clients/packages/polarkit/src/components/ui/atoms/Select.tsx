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
      'rounded-lg',
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
      'rounded-lg',
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
    className={className}
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
    className={className}
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
