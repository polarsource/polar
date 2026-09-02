'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cn } from '@polar-sh/ui/lib/utils'
import type * as React from 'react'

export type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root>

const Checkbox = ({ className, ...props }: CheckboxProps) => (
  <CheckboxPrimitive.Root
    className={cn(
      'ring-offset-background focus-visible:ring-ring peer h-4 w-4 shrink-0 rounded-xs border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      'dark:border-polar-600 border-gray-300 data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white dark:data-[state=checked]:border-white dark:data-[state=checked]:bg-white dark:data-[state=checked]:text-black',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex h-full w-full items-center justify-center text-current">
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
