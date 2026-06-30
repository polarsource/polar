'use client'

import { Grid, Text, Truncated } from '@polar-sh/orbit'
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
    flexGrow={1}
    minWidth={0}
    flexDirection="row"
    justifyContent="between"
    alignItems="baseline"
    columnGap="l"
  >
    <Text color="muted">{label}</Text>
    <Box
      flex={1}
      minWidth={0}
      justifyContent="end"
      alignItems="center"
      columnGap="s"
    >
      {typeof value === 'string' || typeof value === 'number' ? (
        <Truncated tooltip={String(value)}>
          <Text as="span" monospace={monospace} align="right">
            {value}
          </Text>
        </Truncated>
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

export const DetailGrid = ({ children }: { children: ReactNode }) => (
  <Grid
    templateColumns={{
      base: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      lg: 'repeat(3, minmax(0, 1fr))',
    }}
    gap="xl"
  >
    {children}
  </Grid>
)

export const DetailCell = ({
  label,
  value,
  monospace,
  fullWidth,
}: {
  label: ReactNode
  value: ReactNode
  monospace?: boolean
  fullWidth?: boolean
}) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    minWidth={0}
    gridColumn={fullWidth ? '1 / -1' : undefined}
  >
    <Text color="muted">{label}</Text>
    {typeof value === 'string' || typeof value === 'number' ? (
      <Text variant="body" monospace={monospace} truncate>
        {value}
      </Text>
    ) : (
      (value ?? <Text color="muted">—</Text>)
    )}
  </Box>
)
