import type { ReactNode } from 'react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import type { Spacing } from '../primitives/theme'
import { theme } from '../primitives/theme'
import { Box } from './Box'
import { Button, type ButtonProps } from './Button'
import { Stack } from './Stack'

export function Card({
  children,
  className,
  padding = theme.spacing[6],
  gap = theme.spacing[4],
}: {
  children?: ReactNode
  className?: string
  padding?: Spacing
  gap?: Spacing
}) {
  return (
    <Stack
      vertical
      borderRadius={theme.radius.lg}
      padding={padding}
      gap={gap}
      className={twMerge(
        'rounded-(--CARD-RADIUS) bg-(--CARD-BACKGROUND)',
        className,
      )}
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
    <Box
      paddingTop={actions ? theme.spacing[4] : undefined}
      className={className}
    >
      {children}
      {actions && (
        <Stack gap={theme.spacing[3]}>
          {actions.map((props, i) => (
            <Button key={i} {...props} />
          ))}
        </Stack>
      )}
    </Box>
  )
}
