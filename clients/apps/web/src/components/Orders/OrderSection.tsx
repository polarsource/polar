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
  <Box as="section" flexDirection="column" rowGap="xl">
    <Box justifyContent="between" alignItems="start" columnGap="m">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs" as="h3">
          {title}
        </Text>
        {description}
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
        <Truncated>
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

export interface DetailColumnRow {
  key: string
  label: ReactNode
  value: ReactNode
}

export const DetailColumn = ({
  title,
  items,
}: {
  title: ReactNode
  items: DetailColumnRow[]
}) => (
  <Box flexDirection="column" rowGap="l" minWidth={0}>
    <Text variant="body" as="h3">
      {title}
    </Text>
    <Box flexDirection="column" minWidth={0} flex={1}>
      {items.length === 0 ? (
        <Box
          borderColor="border-primary"
          borderWidth={1}
          width="100%"
          height="100%"
          flexGrow={1}
          flex={1}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          padding="5xl"
          borderRadius="s"
        >
          <Text color="muted">No Data</Text>
        </Box>
      ) : (
        items.map((item, index) => (
          <Box
            key={item.key}
            flexDirection="column"
            minWidth={0}
            borderTopWidth={index === 0 ? 0 : 1}
            borderStyle="solid"
            borderColor="border-primary"
            paddingTop={index === 0 ? 'none' : 's'}
            paddingBottom={index === items.length - 1 ? 'none' : 's'}
          >
            <DetailItem label={item.label} value={item.value} />
          </Box>
        ))
      )}
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
