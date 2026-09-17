'use client'

import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight, Gauge } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency } from '@polar-sh/currency'
import { IdentityNode, IdentityRef, identityHref, walk } from './identities'
import { VoidIdentity } from './types'

const credits = (value: number) => `${value.toLocaleString('en-US')} credits`

const ShareBar = ({ share }: { share: number }) => (
  <div className="dark:bg-polar-700 h-1 w-full overflow-hidden bg-gray-200">
    <div
      className="h-full bg-black dark:bg-white"
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
  ownUsage,
}: {
  root: IdentityNode<IdentityRef & { name: string }>
  rolled: Record<string, number>
  base: string
  ownUsage?: Record<string, number>
}) => {
  const total = rolled[root.identity.id] || 1
  const formatUsage = ownUsage
    ? (value: number) => formatCurrency('statistics')(value, 'usd')
    : credits
  const rows: MemberRow[] = walk(root).map((node) => {
    const identity = node.identity
    const series =
      !ownUsage && 'usageSeries' in identity
        ? (identity as VoidIdentity)
        : undefined
    return {
      id: identity.id,
      name:
        identity.id === root.identity.id
          ? `${identity.name} (own)`
          : identity.name,
      href: identityHref(base, identity.id),
      usage:
        ownUsage?.[identity.id] ??
        ('usage' in identity ? (identity.usage as number) : 0),
      meters: series
        ? Object.entries(series.usageSeries).map(([name, values]) => ({
            name,
            units: series.meters[name] ?? 0,
            credits: values.reduce((sum, value) => sum + value, 0),
          }))
        : [],
    }
  })
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
        const expandable = row.meters.length > 0
        return (
          <Box key={row.id} flexDirection="column">
            <Box alignItems="center" columnGap="m" paddingVertical="m">
              {expandable ? (
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
              ) : (
                <Box width={24} height={24} flexShrink={0} />
              )}
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
                    {formatUsage(row.usage)}
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
                      borderRadius="s"
                      backgroundColor="background-card"
                      borderColor="border-primary"
                      borderWidth={1}
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
                      <ShareBar share={meter.credits / total} />
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
