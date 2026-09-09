'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { Alert, Button, SegmentedControl, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useMemo, useState } from 'react'
import { ApprovedResolutionSummary } from './ApprovedResolutionSummary'
import { HeaderCheckState, buildCurrentColumns } from './CurrentRecordColumns'
import { CurrentDataTable, useCurrentPagination } from './CurrentDataTable'
import { MockSubscriptionRecord } from './mockData'
import { PrototypeAction, PrototypeState } from './model'
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
  state,
  act,
}: {
  state: PrototypeState
  act: (action: PrototypeAction) => void
}) {
  const clean = getCleanSubscriptions()
  const problems = getProblemSubscriptions()
  const cleanIds = useMemo(() => new Set(clean.map((row) => row.id)), [clean])
  const [filter, setFilter] = useState<SwitchFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const { page, pageSize, pagination, onPaginationChange, resetPage } =
    useCurrentPagination()

  const rows = filterRows(filter, clean, problems)
  const switchCount = selected.size
  const canSwitch = switchCount === clean.length
  const switchLabel = `Switch ${numberFormat.format(switchCount)} subscriptions`
  const headerState: HeaderCheckState =
    switchCount === 0
      ? 'unchecked'
      : switchCount === clean.length
        ? 'checked'
        : 'indeterminate'

  const selectReady = useCallback(() => {
    setSelected(new Set(clean.map((row) => row.id)))
    setFilter('ready')
    resetPage()
  }, [clean, resetPage, setFilter, setSelected])

  const toggleAllReady = useCallback(() => {
    if (switchCount === clean.length) {
      setSelected(new Set())
      return
    }
    selectReady()
  }, [clean.length, selectReady, setSelected, switchCount])

  const toggle = useCallback(
    (id: string) => {
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
    },
    [cleanIds, setSelected],
  )

  const columns = useMemo(
    () =>
      buildCurrentColumns({
        isSelectable: (id) => cleanIds.has(id),
        isSelected: (id) => selected.has(id),
        headerState,
        canSelectAll: clean.length > 0,
        onToggle: toggle,
        onToggleAll: toggleAllReady,
      }),
    [clean.length, cleanIds, headerState, selected, toggle, toggleAllReady],
  )

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

      <ApprovedResolutionSummary
        state={state}
        act={act}
        compact
        context="transfer"
      />

      <Box
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="m"
        flexWrap="wrap"
      >
        <Box maxWidth="100%" overflowX="auto">
          <SegmentedControl
            value={filter}
            onChange={(next) => {
              setFilter(next as SwitchFilter)
              resetPage()
            }}
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
            disabled={!canSwitch}
            onClick={() => setConfirming(true)}
          >
            {canSwitch
              ? switchLabel
              : `Select all ${clean.length} ready to continue`}
          </Button>
        </Box>
      </Box>

      <CurrentDataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={pageSize}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        emptyMessage={
          filter === 'moved'
            ? 'Nothing has switched to Polar yet.'
            : 'No subscriptions to show.'
        }
      />

      <ConfirmModal
        isShown={confirming}
        hide={() => setConfirming(false)}
        title={`${switchLabel}?`}
        description={`Polar stops these subscriptions on Stripe and starts billing them on their next renewal. The ${problems.length} problem records stay on Stripe. This cannot be automatically undone.`}
        body={
          <Alert
            variant="warning"
            title="Stripe is stopped first"
            description="Polar then activates each subscription without charging today."
          />
        }
        destructive
        destructiveText={switchLabel}
        onConfirm={() => act('transfer')}
      />
    </Box>
  )
}
