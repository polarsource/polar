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

interface CardProps extends React.ComponentProps<typeof CardPrimitive> {
  variant?: 'default' | 'glass'
}

const Card = ({
  ref,
  className,
  variant = 'default',
  ...props
}: CardProps) => (
  <CardPrimitive
    ref={ref}
    className={twMerge(
      'rounded-4xl text-gray-950 shadow-none dark:text-white',
      variant === 'default' && 'dark:bg-polar-800 border-transparent bg-gray-100 dark:border-transparent',
      variant === 'glass' && [
        'border border-white/30 bg-white/20 backdrop-blur-sm',
        'dark:border-white/[0.04] dark:bg-white/[0.02]',
      ],
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
