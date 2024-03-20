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
      'dark:bg-polar-900 bg-gray-75 dark:ring-polar-900 relative flex h-fit w-fit flex-row flex-col items-start gap-2 rounded-xl ring-1 ring-gray-100 md:flex-row',
      vertical
        ? 'flex-col md:flex-col'
        : 'md:flex-row md:items-center md:justify-start',
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
      'hover:text-blue-500 data-[state=active]:rounded-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-500 data-[state=active]:shadow-none dark:data-[state=active]:bg-blue-950 dark:data-[state=active]:text-blue-300',
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

export { Tabs, TabsContent, TabsList, TabsTrigger }
