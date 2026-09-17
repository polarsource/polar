'use client'

import { n, shortModel } from '@/format'
import type { Agent } from '@/db/schema'
import { Avatar, Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card } from './Card'
import { useLive } from './Live'

export const AgentList = ({ agents }: { agents: readonly Agent[] }) => {
  const { agentId } = useParams<{ agentId?: string }>()
  const { member } = useLive()
  if (agents.length === 0)
    return (
      <Text color="muted" style={{ paddingInline: 4 }}>
        No agents yet. Create one below.
      </Text>
    )
  return (
    <Box as="ul" flexDirection="column" rowGap="s" width="100%">
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
              <Card
                alignItems="center"
                columnGap="s"
                padding="s"
                backgroundColor={{
                  base: active ? 'background-card' : 'background-primary',
                  hover: 'background-card',
                }}
                transitionProperty="colors"
                transitionDuration="fast"
                cursor="pointer"
              >
                <Avatar
                  name={agent.name}
                  avatar_url={null}
                  className="h-7 w-7 text-xs"
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
              </Card>
            </Link>
          </Box>
        )
      })}
    </Box>
  )
}
