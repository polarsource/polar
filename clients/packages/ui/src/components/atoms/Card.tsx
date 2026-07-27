import * as React from 'react'

import {
  CardContent as CardContentPrimitive,
  CardHeader as CardHeaderPrimitive,
  Card as CardPrimitive,
} from '@/components/ui/card'
import { twMerge } from 'tailwind-merge'

const Card = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CardPrimitive>) => (
  <CardPrimitive
    ref={ref}
    className={twMerge(
      'dark:bg-polar-800 rounded-4xl border-transparent bg-gray-100 text-gray-950 shadow-none dark:border-transparent dark:text-white',
      className,
    )}
    {...props}
  />
)
Card.displayName = CardPrimitive.displayName

const CardHeader = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CardHeaderPrimitive>) => (
  <CardHeaderPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
CardHeader.displayName = CardHeaderPrimitive.displayName

const CardContent = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CardContentPrimitive>) => (
  <CardContentPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
CardContent.displayName = CardContentPrimitive.displayName

export { Card, CardContent, CardHeader }
