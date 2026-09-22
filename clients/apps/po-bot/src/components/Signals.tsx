'use client'

import { n, pct } from '@/format'
import type { BalanceSignal, AgentJudgment } from '@/void'
import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'
import { Meter } from './Meter'
import { SectionLabel } from './SectionLabel'

const grain = (over: AgentJudgment['over']) =>
  `last ${over.amount} ${over.unit}${over.amount === 1 ? '' : 's'}`

/** The customer's credit pool, latched by the SDK from remaining balance. */
const BalanceRow = ({ signal }: { signal: BalanceSignal }) => {
  if (signal.enterBelow <= 0) return null
  const unread = signal.status === 'unknown'
  return (
    <Box flexDirection="column" rowGap="xs">
      <Box justifyContent="between" alignItems="baseline" columnGap="s">
        <Text variant="caption" as="span">
          {signal.signal}
        </Text>
        <Text
          variant="caption"
          color={signal.status === 'active' ? 'danger' : 'muted'}
          as="span"
          tabularNums
        >
          {unread
            ? 'not read'
            : `${signal.status}, ${n(signal.remaining)} left`}
          {signal.provisional ? ', counting unsent events' : ''}
        </Text>
      </Box>
      <Text variant="caption" color="muted">
        On below {n(signal.enterBelow)} left, clears at {n(signal.exitAtLeast)}.
        Balance of the organization. No model involved.
      </Text>
    </Box>
  )
}

/** Jev's answer about an agent's recent spend. Never moves money. */
const JudgmentRow = ({ judgment }: { judgment: AgentJudgment }) => (
  <Box flexDirection="column" rowGap="xs">
    <Box justifyContent="between" alignItems="baseline" columnGap="s">
      <Text variant="caption" as="span">
        {judgment.signal}
      </Text>
      <Text variant="caption" color="muted" as="span" tabularNums>
        {judgment.noul === null ? 'unknown' : pct(judgment.noul)},{' '}
        {judgment.status}, {n(judgment.events)} events {grain(judgment.over)}
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
)

export const Signals = ({
  balance,
  judgments,
}: {
  balance: BalanceSignal
  judgments: readonly AgentJudgment[]
}) => (
  <Box flexDirection="column" rowGap="s" width="100%">
    <SectionLabel>Signals</SectionLabel>
    <Box flexDirection="column" rowGap="s" paddingHorizontal="xs">
      <BalanceRow signal={balance} />
      {judgments.length === 0 ? (
        <Text variant="caption" color="muted">
          Polar has not judged an agent here yet.
        </Text>
      ) : (
        judgments.map((judgment) => (
          <JudgmentRow
            key={`${judgment.signal}:${judgment.identityId}`}
            judgment={judgment}
          />
        ))
      )}
    </Box>
  </Box>
)
