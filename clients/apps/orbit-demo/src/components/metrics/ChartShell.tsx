'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DeltaChip } from '../DeltaChip'

type ChartShellProps = {
  title: string
  subtitle?: string
  value?: string
  delta?: {
    value: number
    direction: 'up' | 'down'
    tone?: 'semantic' | 'neutral'
  }
  trailing?: React.ReactNode
  height?: number
  children: React.ReactNode
}

export const ChartShell = ({
  title,
  subtitle,
  value,
  delta,
  trailing,
  height = 260,
  children,
}: ChartShellProps) => (
  <Box
    backgroundColor="background-card"
    padding="2xl"
    display="flex"
    flexDirection="column"
    rowGap="2xl"
  >
    <Box
      display="flex"
      alignItems="start"
      justifyContent="between"
      columnGap="l"
    >
      <Box display="flex" flexDirection="column" rowGap="s">
        <Text variant="heading-xs" color="default">
          {title}
        </Text>
        {subtitle && (
          <Text variant="default" color="muted">
            {subtitle}
          </Text>
        )}
      </Box>
      <Box display="flex" alignItems="center" columnGap="l">
        {value && (
          <Text variant="heading-xs" color="default" wrap="nowrap">
            {value}
          </Text>
        )}
        {delta && (
          <DeltaChip
            value={Math.abs(Number(delta.value.toFixed(1)))}
            direction={delta.direction}
            tone={delta.tone}
          />
        )}
        {trailing}
      </Box>
    </Box>
    <Box width="100%" height={height}>
      {children}
    </Box>
  </Box>
)
