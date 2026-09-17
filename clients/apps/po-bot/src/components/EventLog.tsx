'use client'

import { n, pct, time, usd } from '@/format'
import type { LogEvent } from '@/live'
import { Grid, Pill, Text, type PillColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Card } from './Card'
import { useLive } from './Live'
import { Meter } from './Meter'

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

const ACTIVITY_COLOR = {
  plan: 'purple',
  retrieve: 'blue',
  implement: 'green',
  act: 'yellow',
  review: 'gray',
  retry: 'red',
  other: 'gray',
  pending: 'gray',
  unlabeled: 'yellow',
} as const satisfies Record<string, PillColor>

const colorOf = (slug: string): PillColor =>
  slug in ACTIVITY_COLOR
    ? ACTIVITY_COLOR[slug as keyof typeof ACTIVITY_COLOR]
    : 'gray'

const ActivityPill = ({ slug }: { slug: string }) => (
  <Pill color={colorOf(slug)} className="font-mono text-[10px]">
    {slug}
  </Pill>
)

const Mix = () => {
  const { activities } = useLive()
  const { by_activity: shares, totals, taxonomy } = activities
  const waiting = shares.length === 0
  return (
    <Card flexDirection="column" rowGap="xs" padding="s">
      <Box justifyContent="between" alignItems="baseline" columnGap="s">
        <Text variant="caption" color="muted" as="h2">
          Activities
        </Text>
        <Text variant="caption" color="muted" as="span">
          Jev · {taxonomy}
        </Text>
      </Box>
      {waiting ? (
        <Text variant="caption" color="muted">
          {totals.pending_cost > 0
            ? 'Classifying spans…'
            : 'No classified spans yet'}
        </Text>
      ) : (
        <Box flexDirection="column" rowGap="s">
          {shares.map((share) => (
            <Box key={share.slug} flexDirection="column" rowGap="xs">
              <Box justifyContent="between" alignItems="center" columnGap="s">
                <ActivityPill slug={share.slug} />
                <Text variant="caption" color="muted" as="span" tabularNums>
                  {pct(share.share)} · {share.spans}
                </Text>
              </Box>
              <Meter
                share={share.share * 100}
                spent={share.slug === 'retry'}
                height={4}
              />
            </Box>
          ))}
        </Box>
      )}
      {(totals.pending_cost > 0 || totals.unlabeled_cost > 0) && (
        <Text variant="caption" color="muted" as="span" tabularNums>
          {totals.pending_cost > 0 && `pending ${usd(totals.pending_cost)}`}
          {totals.pending_cost > 0 && totals.unlabeled_cost > 0 && ' · '}
          {totals.unlabeled_cost > 0 &&
            `unlabeled ${usd(totals.unlabeled_cost)}`}
        </Text>
      )}
    </Card>
  )
}

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
 * Every completion the plugin recorded, newest first, for the whole
 * organization. Each one was folded into the credits meter of its agent, the
 * agent's member and the org; the balances above show the result. Jev's
 * labels land after ingest and do not move money.
 */
export const EventLog = () => {
  const { events, tree, member } = useLive()
  const org = tree.org.standing
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
        </Grid>
      </Card>

      <Mix />

      <Text variant="caption" color="muted" as="h2">
        Event log
      </Text>
      {events.length === 0 && (
        <Text variant="caption" color="muted">
          Send a message. Its{' '}
          <Text as="code" monospace>
            po_bot.completion
          </Text>{' '}
          event shows up here once the server has it.
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
          const { event, agent, member: who } = entry
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
                  {who} › {agent}
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
                <Text variant="caption" color="muted" monospace>
                  {String(m.model)}
                </Text>
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
