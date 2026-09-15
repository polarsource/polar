'use client'

import { ToplistHeader } from '@/components/Shared/Toplist'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { KindShare } from './insights'

const COLORS: Record<KindShare['kind'], string> = {
  human: '#2563eb',
  agent: '#14b8a6',
  service: '#f59e0b',
}

const LABELS: Record<KindShare['kind'], string> = {
  human: 'Humans',
  agent: 'Agents',
  service: 'Services',
}

export const IdentitiesMakeup = ({ shares }: { shares: KindShare[] }) => {
  const lead = [...shares].sort((a, b) => b.share - a.share)[0]
  return (
    <Box flexDirection="column" rowGap="l">
      <ToplistHeader
        title="Who uses it"
        caption={
          lead
            ? `${LABELS[lead.kind]} drive ${`${Math.round(lead.share * 100)}%`} of usage`
            : 'No usage'
        }
      />
      <Box height={8} width="100%" overflow="hidden" borderRadius="full">
        {shares.map((entry) => (
          <span
            key={entry.kind}
            style={{
              display: 'block',
              height: '100%',
              width: `${entry.share * 100}%`,
              backgroundColor: COLORS[entry.kind],
            }}
          />
        ))}
      </Box>
      <Box flexDirection="column" rowGap="s">
        {shares.map((entry) => (
          <Box
            key={entry.kind}
            alignItems="center"
            justifyContent="between"
            columnGap="m"
          >
            <Box alignItems="center" columnGap="s">
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  display: 'inline-block',
                  backgroundColor: COLORS[entry.kind],
                }}
              />
              <Text>{LABELS[entry.kind]}</Text>
              <Text color="muted" variant="caption">
                {entry.count} {entry.count === 1 ? 'identity' : 'identities'}
              </Text>
            </Box>
            <Text>{`${Math.round(entry.share * 100)}%`}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
