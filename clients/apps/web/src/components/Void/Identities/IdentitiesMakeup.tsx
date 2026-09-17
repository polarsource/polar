'use client'

import { ToplistHeader } from '@/components/Shared/Toplist'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { KindShare } from './insights'

const COLORS: Record<string, string> = {
  human: '#2563eb',
  customer: '#2563eb',
  agent: '#14b8a6',
  service: '#f59e0b',
  identity: '#64748b',
}

const LABELS: Record<string, string> = {
  human: 'Humans',
  customer: 'Customers',
  agent: 'Agents',
  service: 'Services',
  identity: 'Identities',
}

const colorOf = (kind: string) => COLORS[kind] ?? '#94a3b8'
const labelOf = (kind: string) =>
  LABELS[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}s`

export const IdentitiesMakeup = ({ shares }: { shares: KindShare[] }) => {
  const lead = [...shares].sort((a, b) => b.share - a.share)[0]
  const byUsage = shares.some((share) => share.usage > 0)
  return (
    <Box flexDirection="column" rowGap="l">
      <ToplistHeader
        title="Who uses it"
        caption={
          lead
            ? `${labelOf(lead.kind)} drive ${`${Math.round(lead.share * 100)}%`} of ${byUsage ? 'usage' : 'identities'}`
            : 'No identities'
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
              backgroundColor: colorOf(entry.kind),
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
                  backgroundColor: colorOf(entry.kind),
                }}
              />
              <Text>{labelOf(entry.kind)}</Text>
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
