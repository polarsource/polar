'use client'

import { formatPercentage } from '@/utils/formatters'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { dailyUsageFor } from './Identities/insights'
import { IdentityNode, IdentityRef, walk } from './identities'
import { VoidIdentity } from './types'
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
  cadence,
  ownUsage,
}: {
  root: IdentityNode<IdentityRef & { name: string }>
  rolled: Record<string, number>
  base: string
  cadence?: Record<string, number[]>
  ownUsage?: Record<string, number>
}) => {
  const used = rolled[root.identity.id] ?? 0
  const credits: number | null =
    'credits' in root.identity && typeof root.identity.credits === 'number'
      ? root.identity.credits
      : null
  const total = credits ?? used
  const showCredits = credits !== null
  const showMembers = root.children.length > 0
  const remaining = Math.max(total - used, 0)
  const share = total > 0 ? used / total : 0

  const series = useMemo(() => {
    if (cadence) {
      const days = dailyUsageFor(root, cadence)
      return days.length > 0 ? { Usage: days } : {}
    }
    const merged: Record<string, number[]> = {}
    for (const node of walk(root)) {
      if (!('usageSeries' in node.identity)) continue
      const identity = node.identity as VoidIdentity
      for (const [name, values] of Object.entries(identity.usageSeries)) {
        const target = (merged[name] ??= values.map(() => 0))
        values.forEach((value, index) => {
          target[index] += value
        })
      }
    }
    return merged
  }, [root, cadence])

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xxs" as="h3">
          Usage
        </Text>
        <Text color="muted">
          {showCredits
            ? 'Credit allocation and consumption details.'
            : 'Consumption details for this identity and everything below it.'}
        </Text>
      </Box>

      {showCredits ? (
        <Box flexDirection="column" rowGap="m">
          <Box alignItems="baseline" justifyContent="between" columnGap="l">
            <Text>Total credits</Text>
            <Text>{count(total)}</Text>
          </Box>
          <div className="dark:bg-polar-700 h-1 w-full overflow-hidden bg-gray-200">
            <div
              className="h-full bg-black dark:bg-white"
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
      ) : null}

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

      {showMembers ? (
        <Box flexDirection="column" rowGap="l">
          <Subheading
            title="Usage by member"
            caption={`${walk(root).length} identities`}
          />
          <VoidUsageByMember
            root={root}
            rolled={rolled}
            base={base}
            ownUsage={ownUsage}
          />
        </Box>
      ) : null}
    </Box>
  )
}
