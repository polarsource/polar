'use client'

import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, Gauge } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { IdentityNode, walk } from './identities'

const credits = (value: number) => `${value.toLocaleString('en-US')} credits`

const ShareBar = ({ share, muted }: { share: number; muted?: boolean }) => (
  <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
    <div
      className={
        muted
          ? 'h-full rounded-full bg-gray-400 dark:bg-white/30'
          : 'h-full rounded-full bg-blue-500'
      }
      style={{ width: `${Math.max(1, Math.round(share * 100))}%` }}
    />
  </div>
)

interface MemberRow {
  id: string
  name: string
  href: string
  usage: number
  meters: { name: string; units: number; credits: number }[]
}

export const VoidUsageByMember = ({
  root,
  rolled,
  base,
}: {
  root: IdentityNode
  rolled: Record<string, number>
  base: string
}) => {
  const total = rolled[root.identity.id] || 1
  const rows: MemberRow[] = walk(root).map((node) => ({
    id: node.identity.id,
    name:
      node.identity.id === root.identity.id
        ? `${node.identity.name} (own)`
        : node.identity.name,
    href: `${base}/identities/${node.identity.id}`,
    usage: node.identity.usage,
    meters: Object.entries(node.identity.usageSeries).map(([name, series]) => ({
      name,
      units: node.identity.meters[name] ?? 0,
      credits: series.reduce((sum, value) => sum + value, 0),
    })),
  }))
  rows.sort((a, b) => b.usage - a.usage)

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rows.slice(0, 1).map((row) => row.id)),
  )
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Box
      flexDirection="column"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      borderRadius="l"
      paddingHorizontal="xl"
      paddingVertical="m"
    >
      {rows.map((row) => {
        const open = expanded.has(row.id)
        return (
          <Box key={row.id} flexDirection="column">
            <Box alignItems="center" columnGap="m" paddingVertical="m">
              <button
                type="button"
                aria-label={open ? 'Collapse' : 'Expand'}
                aria-expanded={open}
                onClick={() => toggle(row.id)}
                className="dark:text-polar-500 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <ChevronRight
                  size={14}
                  className={
                    open
                      ? 'rotate-90 transition-transform'
                      : 'transition-transform'
                  }
                />
              </button>
              <Avatar className="h-8 w-8" avatar_url={null} name={row.name} />
              <Box flexDirection="column" flex={1} minWidth={0} rowGap="s">
                <Box
                  alignItems="baseline"
                  justifyContent="between"
                  columnGap="l"
                >
                  <Link href={row.href}>
                    <Text truncate>{row.name}</Text>
                  </Link>
                  <Text color="muted" variant="caption" wrap="nowrap">
                    {credits(row.usage)}
                  </Text>
                </Box>
                <ShareBar share={row.usage / total} />
              </Box>
            </Box>
            {open ? (
              <Box flexDirection="column" paddingLeft="4xl" paddingBottom="m">
                {row.meters.map((meter) => (
                  <Box
                    key={meter.name}
                    alignItems="center"
                    columnGap="m"
                    paddingVertical="s"
                  >
                    <Box
                      alignItems="center"
                      justifyContent="center"
                      width={32}
                      height={32}
                      borderRadius="m"
                      backgroundColor="background-card"
                      flexShrink={0}
                    >
                      <Gauge size={14} />
                    </Box>
                    <Box
                      flexDirection="column"
                      flex={1}
                      minWidth={0}
                      rowGap="s"
                    >
                      <Box
                        alignItems="baseline"
                        justifyContent="between"
                        columnGap="l"
                      >
                        <Text truncate>{meter.name}</Text>
                        <Box alignItems="baseline" columnGap="l" flexShrink={0}>
                          <Text color="muted" variant="caption">
                            {meter.units.toLocaleString('en-US')} units
                          </Text>
                          <Text color="muted" variant="caption" wrap="nowrap">
                            {credits(meter.credits)}
                          </Text>
                        </Box>
                      </Box>
                      <ShareBar share={meter.credits / total} muted />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}
