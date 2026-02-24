import React from 'react'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { Box } from './Box'
import { Stack } from './Stack'
import { Button, type ButtonProps } from './Button'
import { tokens } from '../tokens/vars'

export function Card({
  children,
  className,
  padding = tokens.card.padding,
  gap = tokens.card.gap,
}: {
  children?: ReactNode
  className?: string
  padding?: string
  gap?: string
}) {
  return (
    <Stack vertical
      borderRadius={tokens.card.radius}
      padding={padding}
      gap={gap}
      className={twMerge('bg-(--card-background) rounded-(--card-radius)', className)}
    >
      {children}
    </Stack>
  )
}

export function CardHeader({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return <Box className={className}>{children}</Box>
}

export function CardContent({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <Box flex="1" className={className}>
      {children}
    </Box>
  )
}

export function CardFooter({
  children,
  className,
  actions,
}: {
  children?: ReactNode
  className?: string
  actions?: ButtonProps[]
}) {
  return (
    <Box paddingTop={actions ? tokens.card.footer['padding-top'] : undefined} className={className}>
      {children}
      {actions && (
        <Stack gap={tokens.card.footer.gap}>
          {actions.map((props, i) => (
            <Button key={i} {...props} />
          ))}
        </Stack>
      )}
    </Box>
  )
}
