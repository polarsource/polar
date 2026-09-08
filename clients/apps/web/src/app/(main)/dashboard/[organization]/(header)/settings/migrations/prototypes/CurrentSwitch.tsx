'use client'

import { Alert, Button, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo, useState } from 'react'
import { MockSubscriptionRecord } from './mockData'
import { PrototypeAction } from './model'
import { CurrentRecordRow } from './CurrentRecordList'
import { Surface } from './PrototypePrimitives'
import { getCleanSubscriptions, getProblemSubscriptions } from './selectors'

type SwitchFilter = 'all' | 'ready' | 'stripe' | 'moved'

const numberFormat = new Intl.NumberFormat('en-US')

function filterRows(
  filter: SwitchFilter,
  clean: MockSubscriptionRecord[],
  problems: MockSubscriptionRecord[],
): MockSubscriptionRecord[] {
  if (filter === 'ready') {
    return clean
  }
  if (filter === 'stripe') {
    return problems
  }
  if (filter === 'moved') {
    return []
  }
  return [...clean, ...problems]
}

export function CurrentSwitch({
  act,
}: {
  act: (action: PrototypeAction) => void
}) {
  const clean = getCleanSubscriptions()
  const problems = getProblemSubscriptions()
  const cleanIds = useMemo(() => new Set(clean.map((row) => row.id)), [clean])
  const [filter, setFilter] = useState<SwitchFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reviewing, setReviewing] = useState(false)

  const rows = filterRows(filter, clean, problems)
  const switchCount = selected.size

  const selectReady = () => {
    setSelected(new Set(clean.map((row) => row.id)))
    setFilter('ready')
  }

  const toggle = (id: string) => {
    if (!cleanIds.has(id)) {
      return
    }
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (reviewing) {
    return (
      <Surface emphasis>
        <Text variant="heading-xs" as="h3">
          Switch {numberFormat.format(switchCount)} subscriptions?
        </Text>
        <Alert
          variant="warning"
          title="Stripe is stopped first"
          description="Polar then activates each subscription without charging today. This cannot be automatically undone."
        />
        <Text variant="caption" color="muted">
          Polar stops these subscriptions on Stripe and starts billing them on
          their next renewal. The {problems.length} problem records stay on
          Stripe.
        </Text>
        <Box gap="s">
          <Button variant="secondary" onClick={() => setReviewing(false)}>
            Back
          </Button>
          <Button
            onClick={() => {
              setReviewing(false)
              act('transfer')
            }}
          >
            Switch {numberFormat.format(switchCount)} subscriptions
          </Button>
        </Box>
      </Surface>
    )
  }

  return (
    <Box as="section" flexDirection="column" rowGap="l">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="caption" color="muted">
          Polar starts billing the subscriptions you pick, and stops them on
          Stripe first. It reads Stripe again for each one, so anything that
          renews too soon or has no card stays put with a reason.
        </Text>
        <Text variant="caption" tabularNums>
          {clean.length} imported · 0 switched · {clean.length} to switch ·{' '}
          {problems.length} left on Stripe
        </Text>
      </Box>

      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="m"
        flexWrap="wrap"
      >
        <Box maxWidth="100%" overflowX="auto">
          <SegmentedControl
            value={filter}
            onChange={(next) => setFilter(next as SwitchFilter)}
            options={[
              { value: 'all', label: `All ${clean.length + problems.length}` },
              { value: 'ready', label: `To switch ${clean.length}` },
              { value: 'stripe', label: `Left on Stripe ${problems.length}` },
              { value: 'moved', label: 'Switched 0' },
            ]}
          />
        </Box>
        <Box gap="s" flexWrap="wrap">
          <Button size="sm" variant="secondary" onClick={selectReady}>
            Select {clean.length} ready
          </Button>
          <Button
            size="sm"
            disabled={switchCount === 0}
            onClick={() => setReviewing(true)}
          >
            {switchCount > 0
              ? `Switch ${numberFormat.format(switchCount)} subscriptions`
              : 'Switch subscriptions'}
          </Button>
        </Box>
      </Box>

      {rows.length === 0 ? (
        <Box
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          borderRadius="l"
          paddingVertical="2xl"
          justifyContent="center"
        >
          <Text variant="caption" color="muted">
            Nothing has switched to Polar yet.
          </Text>
        </Box>
      ) : (
        <Box as="ul" flexDirection="column" rowGap="s" aria-label="Switch rows">
          {rows.map((record) => (
            <CurrentRecordRow
              key={record.id}
              record={record}
              selectable={cleanIds.has(record.id)}
              selected={selected.has(record.id)}
              onToggle={() => toggle(record.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
