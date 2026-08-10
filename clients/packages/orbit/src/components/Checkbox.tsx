'use client'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check, Minus } from 'lucide-react'
import * as React from 'react'

import { cn } from '../lib/utils'
import { Box } from './Box'
import { Text } from './Text'

export interface CheckboxProps extends React.ComponentProps<
  typeof CheckboxPrimitive.Root
> {
  emphasized?: boolean
  label?: string
}

const Checkbox = ({
  ref,
  className,
  emphasized,
  label,
  ...props
}: CheckboxProps) => {
  const checkbox = (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'ring-offset-background focus-visible:ring-ring peer h-4 w-4 shrink-0 rounded-xs border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        emphasized
          ? 'border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'
          : 'dark:border-polar-600 border-gray-300 data-[state=checked]:border-black data-[state=checked]:bg-black data-[state=checked]:text-white dark:data-[state=checked]:border-white dark:data-[state=checked]:bg-white dark:data-[state=checked]:text-black',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          'group flex h-full w-full items-center justify-center text-current',
        )}
      >
        <Check className="h-4 w-4 group-data-[state=indeterminate]:hidden" />
        <Minus
          className={cn(
            'hidden h-3 w-3 group-data-[state=indeterminate]:block',
            emphasized ? 'text-primary' : 'text-black dark:text-white',
          )}
          strokeWidth={3}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (!label) {
    return checkbox
  }

  return (
    <Box
      as="label"
      display="inline-flex"
      alignItems="center"
      columnGap="s"
      cursor={props.disabled ? 'not-allowed' : 'pointer'}
    >
      {checkbox}
      <Text as="span">{label}</Text>
    </Box>
  )
}
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
