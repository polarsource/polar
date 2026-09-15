'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { IdentityTree } from '../identities'
import { VoidUsageChart } from '../VoidUsageChart'
import { Concentration, dailyUsageFor } from './insights'

const TOP = 4

export const IdentitiesUsage = ({
  tree,
  concentration,
}: {
  tree: IdentityTree
  concentration: Concentration
}) => {
  const series = useMemo(() => {
    const top = concentration.top.slice(0, TOP)
    const topIds = new Set(top.map((entry) => entry.identity.id))
    const merged: Record<string, number[]> = {}
    for (const entry of top) {
      const root = tree.byId.get(entry.identity.id)
      if (root) merged[entry.identity.name] = dailyUsageFor(root)
    }
    const other: number[] = []
    for (const root of tree.roots) {
      if (topIds.has(root.identity.id)) continue
      dailyUsageFor(root).forEach((value, day) => {
        other[day] = (other[day] ?? 0) + value
      })
    }
    if (other.some((value) => value > 0)) merged.Other = other
    return merged
  }, [tree, concentration])

  const topShare = concentration.top
    .slice(0, 3)
    .reduce((total, entry) => total + entry.share, 0)

  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="baseline" justifyContent="between" columnGap="l">
        <Text variant="heading-xs" as="h2">
          Usage
        </Text>
        <Text color="muted" variant="caption">
          Last 30 days
        </Text>
      </Box>
      <Box
        flexDirection="column"
        rowGap="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        padding="l"
      >
        <Text color="muted" variant="caption">
          Top 3 customers carry {`${Math.round(topShare * 100)}%`} of usage
        </Text>
        <VoidUsageChart series={series} height={240} />
      </Box>
    </Box>
  )
}
