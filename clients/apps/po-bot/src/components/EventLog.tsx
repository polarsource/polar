'use client'

import { n, pct, time, usd } from '@/format'
import type { LogEvent } from '@/live'
import type { AgentJudgment } from '@/void'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from 'lucide-react'
import { useParams } from 'next/navigation'
import { ActivityPill, MixSection } from './Activity'
import { Divider } from './Card'
import { useChatActivity, useLive } from './Live'
import { Meter } from './Meter'
import { SectionLabel } from './SectionLabel'

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

const grain = (over: AgentJudgment['over']) =>
  `last ${over.amount} ${over.unit}${over.amount === 1 ? '' : 's'}`

/** Jev's answer to the SDK's question about an agent's recent spend. Never moves money. */
const SignalSection = ({
  judgments,
}: {
  judgments: readonly AgentJudgment[]
}) => (
  <Box flexDirection="column" rowGap="s" width="100%">
    <SectionLabel>Signals</SectionLabel>
    {judgments.length === 0 ? (
      <Text variant="caption" color="muted" style={{ paddingInline: 4 }}>
        Polar has not judged this identity yet.
      </Text>
    ) : (
      <Box flexDirection="column" rowGap="s" paddingHorizontal="xs">
        {judgments.map((judgment) => (
          <Box
            key={`${judgment.signal}:${judgment.identityId}`}
            flexDirection="column"
            rowGap="xs"
          >
            <Box justifyContent="between" alignItems="baseline" columnGap="s">
              <Text variant="caption" as="span">
                {judgment.signal}
              </Text>
              <Text variant="caption" color="muted" as="span" tabularNums>
                {judgment.noul === null ? 'unknown' : pct(judgment.noul)},{' '}
                {judgment.status}, {n(judgment.events)} events{' '}
                {grain(judgment.over)}
              </Text>
            </Box>
            <Meter
              share={(judgment.noul ?? 0) * 100}
              spent={judgment.status === 'active'}
              height={4}
            />
            <Text variant="caption" color="muted">
              {judgment.when}
            </Text>
          </Box>
        ))}
      </Box>
    )}
  </Box>
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
          ? `, waste ${pct(span.waste)}`
          : ''}
      </Text>
    </Box>
  )
}

const Entry = ({ entry, scoped }: { entry: LogEvent; scoped: boolean }) => {
  const { event, agent: who, member: owner } = entry
  const m = event.metadata
  return (
    <Box
      as="li"
      display="flex"
      flexDirection="column"
      rowGap="xs"
      paddingHorizontal="m"
      paddingVertical="s"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
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
      <Grid templateColumns="auto 1fr" columnGap="m" rowGap="none">
        <Row label="tokens">
          {n(m.input_tokens)} in, {n(m.output_tokens)} out
        </Row>
        <Row label="credits">{n(m.credits)}</Row>
        <Row label="gateway cost">{usd(m.cost)}</Row>
      </Grid>
      <details className="disclosure">
        <summary>
          <Box alignItems="center" columnGap="xs" color="text-secondary">
            <Box as="span" className="disclosure-chevron" display="inline-flex">
              <ChevronRight size={12} />
            </Box>
            <Text variant="caption" color="muted" as="span">
              full event
            </Text>
          </Box>
        </summary>
        <Box
          overflowX="auto"
          borderRadius="s"
          backgroundColor="background-card"
          padding="s"
          marginTop="xs"
        >
          <pre className="event-json">{JSON.stringify(event, null, 2)}</pre>
        </Box>
      </details>
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
  const { tree, member, judgments } = useLive()
  const { events, mix, agent } = useChatActivity(agentId)
  const org = tree.org.standing
  const scoped = Boolean(agentId)
  const ids = scoped
    ? new Set([agentId])
    : new Set(member.agents.map((row) => row.id))
  const shown = judgments.filter((judgment) => ids.has(judgment.identityId))
  return (
    <Box flexDirection="column" height="100%" width="100%" minHeight={0}>
      <Box flexDirection="column" rowGap="xs" padding="m">
        <SectionLabel>Reducers</SectionLabel>
        <Grid
          templateColumns="auto 1fr"
          columnGap="m"
          rowGap="xs"
          paddingHorizontal="xs"
        >
          <Row label="org pool">
            {n(org.usage)} used, {n(org.remaining)} left of {n(org.credits)}
          </Row>
          <Row label="this member">
            {n(member.standing.usage)} used, {n(member.standing.remaining)} left
          </Row>
          {agent && <Row label="this chat">{n(agent.standing.usage)} used</Row>}
        </Grid>
      </Box>
      <Divider />

      <Box padding="m">
        <MixSection
          title={agent ? `${agent.name}'s chat` : "This member's chats"}
          mix={mix}
        />
      </Box>
      <Divider />

      <Box padding="m">
        <SignalSection judgments={shown} />
      </Box>
      <Divider />

      <Box paddingHorizontal="m" paddingTop="m" paddingBottom="xs">
        <SectionLabel>{agent ? 'This chat' : 'Event log'}</SectionLabel>
      </Box>
      {events.length === 0 && (
        <Box paddingHorizontal="m" paddingBottom="m">
          <Text variant="caption" color="muted" style={{ paddingInline: 4 }}>
            {scoped
              ? 'Send a message. Its completion shows up here once the server has it.'
              : 'Pick an agent, or send a message from one of them.'}
          </Text>
        </Box>
      )}
      <Box
        as="ol"
        flexDirection="column"
        minHeight={0}
        flex={1}
        overflowY="auto"
      >
        {events.map((entry) => (
          <Entry key={entry.event.id} entry={entry} scoped={scoped} />
        ))}
      </Box>
    </Box>
  )
}
