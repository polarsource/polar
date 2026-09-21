'use client'

import type { AgentNode, LogEvent } from '@/channels'
import { n, shortModel, time } from '@/format'
import { useBusy, useChatActivity, useMemberNode } from '@/hooks/live'
import { useAgents } from '@/hooks/queries'
import { Avatar } from '@polar-sh/orbit/Avatar'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Meter } from './Meter'

const lastByAgent = (events: readonly LogEvent[]) => {
  const last = new Map<string, LogEvent>()
  for (const entry of events) {
    const id = entry.event.external_identity_id
    if (id && !last.has(id)) last.set(id, entry)
  }
  return last
}

const lastLine = (entry: LogEvent) => {
  const credits = entry.event.metadata.credits
  return `${n(typeof credits === 'number' ? credits : 0)} cr · ${time(entry.event.timestamp)}`
}

/** A roster of agents: identity, last spend, and a meter against the member cap. */
export const AgentList = () => {
  const { id: memberId, agentId } = useParams<{
    id: string
    agentId?: string
  }>()
  const agents = useAgents(memberId)
  const member = useMemberNode(memberId)
  const busy = useBusy()
  const { events } = useChatActivity()
  const last = lastByAgent(events)

  return (
    <Box flexDirection="column" rowGap="s" minHeight={72} flex={1}>
      <Box
        justifyContent="between"
        alignItems="baseline"
        paddingHorizontal="xs"
      >
        <Text variant="label" as="h2">
          Agents
        </Text>
        <Text variant="caption" color="muted" tabularNums>
          {agents.length}
        </Text>
      </Box>
      {agents.length === 0 ? (
        <Text variant="caption" color="muted" style={{ paddingInline: 8 }}>
          No agents yet. Create one below.
        </Text>
      ) : (
        <Box
          as="ul"
          flexDirection="column"
          rowGap="s"
          minHeight={0}
          flex={1}
          overflowY="auto"
        >
          {agents.map((agent) => (
            <Box as="li" key={agent.id}>
              <Row
                agent={agent}
                cap={member.cap}
                active={agent.id === agentId}
                busy={busy.has(agent.id)}
                last={last.get(agent.id)}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

const Row = ({
  agent,
  cap,
  active,
  busy,
  last,
}: {
  agent: AgentNode
  cap: number
  active: boolean
  busy: boolean
  last?: LogEvent
}) => {
  const share = cap > 0 ? Math.min(100, (agent.standing.usage / cap) * 100) : 0
  return (
    <Link
      href={`/members/${agent.memberId}/agents/${agent.id}`}
      style={{ color: 'inherit', display: 'block', textDecoration: 'none' }}
    >
      <Box
        className="nav-row"
        data-active={active}
        flexDirection="column"
        rowGap="s"
        padding="m"
        borderRadius="l"
        cursor="pointer"
      >
        <Box alignItems="center" columnGap="m">
          <Box className={busy ? 'node-busy' : undefined} borderRadius="full">
            <Avatar
              name={agent.name}
              avatar_url={null}
              className="h-10 w-10 text-sm"
            />
          </Box>
          <Box flexDirection="column" minWidth={0} flex={1}>
            <Text variant="label" truncate>
              {agent.name}
            </Text>
            <Text variant="caption" color="muted">
              {last ? lastLine(last) : 'No spend yet'}
            </Text>
          </Box>
        </Box>
        <Box flexDirection="column" rowGap="xs" width="100%">
          <Box justifyContent="between" alignItems="baseline" columnGap="s">
            <Text variant="caption" color="muted" truncate>
              {shortModel(agent.model)}
            </Text>
            <Text variant="caption" color="muted" tabularNums>
              {n(agent.standing.usage)}
            </Text>
          </Box>
          <Meter
            share={share}
            spent={agent.standing.remaining === 0}
            height={4}
          />
        </Box>
      </Box>
    </Link>
  )
}
