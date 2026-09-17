'use client'

import { ToplistHeader } from '@/components/Shared/Toplist'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { identityHref } from '../identities'
import { Runway } from './insights'

const LIMIT = 5

const count = (value: number) => value.toLocaleString('en-US')

const label = (entry: Runway) => {
  if (entry.remaining === 0) return 'Out of credits'
  if (entry.daysLeft === null) return 'No usage this week'
  if (entry.daysLeft === 0) return 'Runs out today'
  return `${entry.daysLeft} ${entry.daysLeft === 1 ? 'day' : 'days'} left`
}

export const IdentitiesRunway = ({
  entries,
  base,
}: {
  entries: Runway[]
  base: string
}) => (
  <Box flexDirection="column" rowGap="l">
    <ToplistHeader title="Credit runway" caption="At last week's burn" />
    <Box flexDirection="column" rowGap="l">
      {entries.slice(0, LIMIT).map((entry) => {
        const share = entry.credits > 0 ? entry.used / entry.credits : 0
        const urgent = entry.daysLeft !== null && entry.daysLeft <= 7
        return (
          <Link
            key={entry.identity.id}
            href={identityHref(base, entry.identity.id)}
          >
            <Box flexDirection="column" rowGap="s">
              <Box alignItems="center" columnGap="m">
                <Avatar
                  className="h-8 w-8"
                  avatar_url={null}
                  name={entry.identity.name}
                />
                <Box flexDirection="column" minWidth={0} flexGrow={1}>
                  <Text truncate>{entry.identity.name}</Text>
                  <Text color="muted" variant="caption">
                    {count(entry.used)} of {count(entry.credits)} credits
                  </Text>
                </Box>
                <Text color={urgent ? 'warning' : 'muted'} variant="caption">
                  {label(entry)}
                </Text>
              </Box>
              <Box
                height={4}
                width="100%"
                overflow="hidden"
                backgroundColor="background-card"
                borderRadius="full"
              >
                <Box
                  height="100%"
                  width={`${Math.min(100, share * 100)}%`}
                  backgroundColor="background-inverse"
                />
              </Box>
            </Box>
          </Link>
        )
      })}
    </Box>
  </Box>
)
