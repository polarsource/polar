'use client'

import { formatPercentage } from '@/utils/formatters'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { IdentityNode, walk } from './identities'
import { VoidUsageByMember } from './VoidUsageByMember'
import { VoidUsageChart } from './VoidUsageChart'

const count = (value: number) => value.toLocaleString('en-US')

const Subheading = ({
  title,
  caption,
}: {
  title: string
  caption?: string
}) => (
  <Box alignItems="baseline" justifyContent="between" columnGap="l">
    <Text variant="body" as="h4">
      {title}
    </Text>
    {caption ? (
      <Text color="muted" variant="caption">
        {caption}
      </Text>
    ) : null}
  </Box>
)

export const VoidIdentityUsage = ({
  root,
  rolled,
  base,
}: {
  root: IdentityNode
  rolled: Record<string, number>
  base: string
}) => {
  const used = rolled[root.identity.id]
  const total = root.identity.credits ?? used
  const remaining = Math.max(total - used, 0)
  const share = total > 0 ? used / total : 0

  const series = useMemo(() => {
    const merged: Record<string, number[]> = {}
    for (const node of walk(root)) {
      for (const [name, values] of Object.entries(node.identity.usageSeries)) {
        const target = (merged[name] ??= values.map(() => 0))
        values.forEach((value, index) => {
          target[index] += value
        })
      }
    }
    return merged
  }, [root])

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          Usage
        </Text>
        <Text color="muted">Credit allocation and consumption details.</Text>
      </Box>

      <Box
        flexDirection="column"
        rowGap="m"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="l"
        padding="xl"
      >
        <Box alignItems="baseline" justifyContent="between" columnGap="l">
          <Text>Total credits</Text>
          <Text>{count(total)}</Text>
        </Box>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
        <Box alignItems="baseline" justifyContent="between" columnGap="l">
          <Text color="muted" variant="caption">
            {count(used)} used ({formatPercentage(share)})
          </Text>
          <Text color="muted" variant="caption">
            {count(remaining)} remaining
          </Text>
        </Box>
        <Link href={`${base}/definition/events`}>
          <Box alignItems="center" columnGap="xs">
            <ChevronRight size={12} />
            <Text variant="caption">View history</Text>
          </Box>
        </Link>
      </Box>

      <Box flexDirection="column" rowGap="l">
        <Subheading title="Usage over time" caption="Last 30 days" />
        <Box
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="l"
          padding="l"
        >
          <VoidUsageChart series={series} />
        </Box>
      </Box>

      <Box flexDirection="column" rowGap="l">
        <Subheading
          title="Usage by member"
          caption={`${walk(root).length} identities`}
        />
        <VoidUsageByMember root={root} rolled={rolled} base={base} />
      </Box>
    </Box>
  )
}
