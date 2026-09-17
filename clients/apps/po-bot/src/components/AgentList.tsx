'use client'

import { n, shortModel } from '@/format'
import type { Agent } from '@/db/schema'
import { Avatar, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useLive } from './Live'

/** Flat rows like the dashboard's navigation: tinted on hover and when open. */
export const AgentList = ({ agents }: { agents: readonly Agent[] }) => {
  const { agentId } = useParams<{ agentId?: string }>()
  const { member } = useLive()
  if (agents.length === 0)
    return (
      <Text variant="caption" color="muted" style={{ paddingInline: 8 }}>
        No agents yet. Create one below.
      </Text>
    )
  return (
    <Box as="ul" flexDirection="column" rowGap="none" width="100%">
      {agents.map((agent) => {
        const active = agent.id === agentId
        const used =
          member.agents.find((own) => own.id === agent.id)?.standing.usage ?? 0
        return (
          <Box as="li" key={agent.id}>
            <Link
              href={`/members/${agent.memberId}/agents/${agent.id}`}
              style={{ display: 'contents' }}
            >
              <Box
                className="nav-row"
                data-active={active}
                alignItems="center"
                columnGap="s"
                paddingHorizontal="s"
                paddingVertical="xs"
                borderRadius="m"
                cursor="pointer"
              >
                <Avatar
                  name={agent.name}
                  avatar_url={null}
                  className="h-6 w-6 text-[10px]"
                />
                <Box flexDirection="column" minWidth={0} flex={1}>
                  <Text variant="caption" truncate>
                    {agent.name}
                  </Text>
                  <Text variant="caption" color="muted" tabularNums>
                    {n(used)} credits
                  </Text>
                </Box>
                <Pill color="gray" className="font-mono text-[10px]">
                  {shortModel(agent.model)}
                </Pill>
              </Box>
            </Link>
          </Box>
        )
      })}
    </Box>
  )
}
