import * as React from 'react'

import { twMerge } from 'tailwind-merge'
import {
  CardContent as CardContentPrimitive,
  CardDescription as CardDescriptionPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
  Card as CardPrimitive,
  CardTitle as CardTitlePrimitive,
} from '../card'

const Card = React.forwardRef<
  React.ElementRef<typeof CardPrimitive>,
  React.ComponentPropsWithoutRef<typeof CardPrimitive>
>(({ className, ...props }, ref) => (
  <CardPrimitive
    ref={ref}
    className={twMerge(
      'dark:text-polar-50 dark:border-polar-700 dark:bg-polar-900 rounded-2xl border-gray-100 bg-white text-gray-950 shadow-sm',
      className,
    )}
    {...props}
  />
))
Card.displayName = CardPrimitive.displayName

const CardHeader = React.forwardRef<
  React.ElementRef<typeof CardHeaderPrimitive>,
  React.ComponentPropsWithoutRef<typeof CardHeaderPrimitive>
>(({ className, ...props }, ref) => (
  <CardHeaderPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
))
CardHeader.displayName = CardHeaderPrimitive.displayName

const CardTitle = React.forwardRef<
  React.ElementRef<typeof CardTitlePrimitive>,
  React.ComponentPropsWithoutRef<typeof CardTitlePrimitive>
>(({ className, ...props }, ref) => (
  <CardTitlePrimitive ref={ref} className={twMerge('', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  React.ElementRef<typeof CardDescriptionPrimitive>,
  React.ComponentPropsWithoutRef<typeof CardDescriptionPrimitive>
>(({ className, ...props }, ref) => (
  <CardDescriptionPrimitive
    ref={ref}
    className={twMerge('dark:text-polar-400 text-sm text-gray-400', className)}
    {...props}
  />
))
CardDescription.displayName = CardDescriptionPrimitive.displayName

const CardContent = React.forwardRef<
  React.ElementRef<typeof CardContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof CardContentPrimitive>
>(({ className, ...props }, ref) => (
  <CardContentPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
))
CardContent.displayName = CardContentPrimitive.displayName

const CardFooter = React.forwardRef<
  React.ElementRef<typeof CardFooterPrimitive>,
  React.ComponentPropsWithoutRef<typeof CardFooterPrimitive>
>(({ className, ...props }, ref) => (
  <CardFooterPrimitive
    ref={ref}
    className={twMerge('', className)}
    {...props}
  />
))
CardFooter.displayName = CardFooterPrimitive.displayName

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
