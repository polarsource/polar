'use client'

import { n, pct, time, usd } from '@/format'
import type { LogEvent } from '@/live'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useParams } from 'next/navigation'
import { ActivityPill, MixCard } from './Activity'
import { Card } from './Card'
import { useChatActivity, useLive } from './Live'

const Row = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <>
    <Text variant="caption" color="muted" as="span">
      {label}
    </Text>
    <Text variant="caption" as="span" tabularNums>
      {children}
    </Text>
  </>
)

const Span = ({ event }: { event: LogEvent }) => {
  const { span } = event
  if (!span)
    return (
      <Text variant="caption" color="muted" as="span">
        awaiting Jev
      </Text>
    )
  return (
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <ActivityPill slug={span.activity} />
      <Text variant="caption" color="muted" as="span" tabularNums>
        {pct(span.activity_confidence)}
        {span.waste != null && span.waste > 0
          ? ` · waste ${pct(span.waste)}`
          : ''}
      </Text>
    </Box>
  )
}

/**
 * Completions for the open chat — the agent identity that recorded them —
 * newest first. Each one was folded into that agent's credits, then the
 * member and the org; Jev's labels land after ingest and do not move money.
 */
export const EventLog = () => {
  const { agentId } = useParams<{ agentId?: string }>()
  const { tree, member } = useLive()
  const { events, mix, agent, taxonomy } = useChatActivity(agentId)
  const org = tree.org.standing
  const scoped = Boolean(agentId)
  return (
    <Box flexDirection="column" rowGap="s" height="100%" width="100%">
      <Card flexDirection="column" rowGap="xs" padding="s">
        <Text variant="caption" color="muted" as="h2">
          Reducers
        </Text>
        <Grid templateColumns="auto 1fr" columnGap="m" rowGap="xs">
          <Row label="org pool">
            {n(org.usage)} used · {n(org.remaining)} left of {n(org.credits)}
          </Row>
          <Row label="this member">
            {n(member.standing.usage)} used · {n(member.standing.remaining)}{' '}
            left
          </Row>
          {agent && <Row label="this chat">{n(agent.standing.usage)} used</Row>}
        </Grid>
      </Card>

      <MixCard
        title={agent ? `${agent.name}'s chat` : "This member's chats"}
        taxonomy={taxonomy}
        mix={mix}
      />

      <Text variant="caption" color="muted" as="h2">
        {agent ? 'This chat' : 'Event log'}
      </Text>
      {events.length === 0 && (
        <Text variant="caption" color="muted">
          {scoped
            ? 'Send a message. Its completion shows up here once the server has it.'
            : 'Pick an agent, or send a message from one of them.'}
        </Text>
      )}
      <Box
        as="ol"
        flexDirection="column"
        rowGap="xs"
        minHeight={0}
        flex={1}
        overflowY="auto"
      >
        {events.map((entry) => {
          const { event, agent: who, member: owner } = entry
          const m = event.metadata
          return (
            <Card
              as="li"
              key={event.id}
              display="flex"
              flexDirection="column"
              padding="s"
            >
              <Box justifyContent="between" alignItems="baseline" columnGap="s">
                <Text variant="caption" as="span">
                  {scoped ? String(m.model) : `${owner} › ${who}`}
                </Text>
                <Text variant="caption" color="muted" as="span" tabularNums>
                  {time(event.timestamp)}
                </Text>
              </Box>
              <Box
                justifyContent="between"
                alignItems="center"
                columnGap="s"
                minWidth={0}
              >
                {!scoped && (
                  <Text variant="caption" color="muted" monospace>
                    {String(m.model)}
                  </Text>
                )}
                <Span event={entry} />
              </Box>
              <Grid
                templateColumns="auto 1fr"
                columnGap="m"
                rowGap="none"
                marginTop="xs"
              >
                <Row label="tokens">
                  {n(m.input_tokens)} in · {n(m.output_tokens)} out
                </Row>
                <Row label="credits">{n(m.credits)}</Row>
                <Row label="gateway cost">{usd(m.cost)}</Row>
              </Grid>
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer' }}>
                  <Text variant="caption" color="muted" as="span">
                    full event
                  </Text>
                </summary>
                <Box
                  overflowX="auto"
                  borderRadius="s"
                  backgroundColor="background-card"
                  padding="s"
                  marginTop="xs"
                >
                  <pre className="event-json">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                </Box>
              </details>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}
