'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'

export const OrderSection = ({
  title,
  description,
  action,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}) => (
  <Box as="section" flexDirection="column" rowGap="l">
    <Box justifyContent="between" alignItems="start" columnGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          {title}
        </Text>
        {description && <Text color="muted">{description}</Text>}
      </Box>
      {action}
    </Box>
    {children}
  </Box>
)

export const DetailItem = ({
  label,
  value,
  action,
  monospace,
}: {
  label: ReactNode
  value: ReactNode
  action?: ReactNode
  monospace?: boolean
}) => (
  <Box
    flexDirection={{ base: 'column', md: 'row' }}
    justifyContent={{ md: 'between' }}
    alignItems={{ md: 'baseline' }}
    columnGap="l"
    rowGap="xs"
  >
    <Text color="muted" variant="body">
      {label}
    </Text>
    <Box alignItems="center" columnGap="s" minWidth={0}>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text as="span" variant="body" monospace={monospace} align="right">
          {value}
        </Text>
      ) : (
        (value ?? (
          <Text as="span" color="muted">
            —
          </Text>
        ))
      )}
      {action}
    </Box>
  </Box>
)
