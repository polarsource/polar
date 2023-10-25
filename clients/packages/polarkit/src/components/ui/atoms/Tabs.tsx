import React from 'react'
import { twMerge } from 'tailwind-merge'
import {
  TabsContent as TabsContentPrimitive,
  TabsList as TabsListPrimitive,
  Tabs as TabsPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from '../tabs'

const Tabs = TabsPrimitive

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsListPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsListPrimitive> & {
    vertical?: boolean
  }
>(({ className, vertical, ...props }, ref) => (
  <TabsListPrimitive
    ref={ref}
    className={twMerge(
      'dark:bg-polar-900 flex h-fit w-fit flex-col items-start gap-2 rounded-xl',
      vertical ? '' : 'md:flex-row md:items-center md:justify-start',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsListPrimitive.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsTriggerPrimitive> & {
    size?: 'small' | 'default'
  }
>(({ className, size = 'default', ...props }, ref) => (
  <TabsTriggerPrimitive
    ref={ref}
    className={twMerge(
      'dark:text-polar-500 dark:data-[state=active]:bg-polar-700 dark:hover:text-polar-50 dark:data-[state=active]:text-polar-50 flex w-full flex-row items-center gap-x-2 px-4 py-2 font-normal hover:text-gray-950 data-[state=active]:font-medium data-[state=active]:text-gray-800 dark:data-[state=active]:text-white',
      size === 'default' ? 'text-sm' : 'text-xs',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsTriggerPrimitive.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsContentPrimitive>
>(({ className, ...props }, ref) => (
  <TabsContentPrimitive ref={ref} className={twMerge(className)} {...props} />
))
TabsContent.displayName = TabsContentPrimitive.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
