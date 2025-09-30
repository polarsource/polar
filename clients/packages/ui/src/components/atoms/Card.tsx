import * as React from 'react'

import {
  CardContent as CardContentPrimitive,
  CardDescription as CardDescriptionPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
  Card as CardPrimitive,
  CardTitle as CardTitlePrimitive,
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

const CardTitle = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CardTitlePrimitive>) => (
  <CardTitlePrimitive ref={ref} className={twMerge('', className)} {...props} />
)
CardTitle.displayName = 'CardTitle'

const CardDescription = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CardDescriptionPrimitive>) => (
  <CardDescriptionPrimitive
    ref={ref}
    className={twMerge('dark:text-polar-400 text-sm text-gray-400', className)}
    {...props}
  />
)
CardDescription.displayName = CardDescriptionPrimitive.displayName

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

const CardFooter = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CardFooterPrimitive>) => (
  <CardFooterPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
)
CardFooter.displayName = CardFooterPrimitive.displayName

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
