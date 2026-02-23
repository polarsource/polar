import React from 'react'
import type { ReactNode } from 'react'
import { Box } from './Box'
import { Stack } from './Stack'
import { Button, type ButtonProps } from './Button'
import type { OrbitSpacing } from '../tokens/theme'

export function Card({
  children,
  className,
  padding = 3,
  gap = 2,
}: {
  children?: ReactNode
  className?: string
  padding?: OrbitSpacing
  gap?: OrbitSpacing
}) {
  return (
    <Stack
      backgroundColor="bg-surface"
      borderRadius="lg"
      padding={padding}
      gap={gap}
      className={className}
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
    <Box paddingTop={actions ? 2 : undefined} className={className}>
      {children}
      {actions && (
        <Stack className="flex-row gap-3">
          {actions.map((props, i) => (
            <Button key={i} {...props} />
          ))}
        </Stack>
      )}
    </Box>
  )
}
