'use client'

import { n, time, usd } from '@/format'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Card } from './Card'
import { useLive } from './Live'

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

/**
 * Every completion the plugin recorded, newest first, for the whole
 * organization. Each one was folded into the credits meter of its agent, the
 * agent's member and the org; the balances above show the result.
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
        {events.map(({ event, agent, member }) => {
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
                  {member} › {agent}
                </Text>
                <Text variant="caption" color="muted" as="span" tabularNums>
                  {time(event.timestamp)}
                </Text>
              </Box>
              <Text variant="caption" color="muted" monospace>
                {String(m.model)}
              </Text>
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
