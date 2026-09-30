'use client'

import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCount, subscriptionsLabel, TAX_LABELS } from './bulkTaxCopy'
import { BulkTaxController } from './useBulkTaxUpdate'

const SHOWN_FAILURES = 5

export function BulkTaxProgressBar({
  done,
  total,
}: {
  done: number
  total: number
}) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <Box
      height={6}
      width="100%"
      borderRadius="full"
      backgroundColor="background-secondary"
      overflow="hidden"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <Box
        height="100%"
        width={`${percent}%`}
        backgroundColor="background-inverse"
        transitionProperty="all"
        transitionDuration="base"
      />
    </Box>
  )
}

export function BulkTaxProgress({
  controller,
  onDismiss,
}: {
  controller: BulkTaxController
  onDismiss?: () => void
}) {
  const { state, retry } = controller
  const target = state.target
  if (state.phase === 'idle' || target === null) {
    return null
  }

  if (state.phase === 'collecting') {
    return (
      <Box alignItems="center" columnGap="s">
        <Spinner />
        <Text variant="caption" color="muted">
          Finding subscriptions that haven&apos;t switched yet…
        </Text>
      </Box>
    )
  }

  const settled = state.updated + state.failures.length
  if (state.phase === 'running') {
    return (
      <Box flexDirection="column" rowGap="s" width="100%">
        <Text variant="caption" tabularNums>
          Updating {formatCount(settled)} of {formatCount(state.total)}…
        </Text>
        <BulkTaxProgressBar done={settled} total={state.total} />
      </Box>
    )
  }

  const label = TAX_LABELS[target].toLowerCase()
  if (state.error) {
    return (
      <Alert
        variant="danger"
        title="We couldn't load your subscriptions"
        description={state.error}
        actions={[{ text: 'Try again', onClick: retry }]}
        onDismiss={onDismiss}
      />
    )
  }

  if (state.total === 0) {
    return (
      <Alert
        variant="success"
        title={`Every subscription is already ${label}`}
        description="Nothing needed to change."
        onDismiss={onDismiss}
      />
    )
  }

  const title = `Updated ${formatCount(state.updated)} of ${subscriptionsLabel(state.total)}`
  const already =
    state.alreadySet > 0
      ? ` ${subscriptionsLabel(state.alreadySet)} were already ${label}.`
      : ''

  if (state.failures.length === 0) {
    return (
      <Alert
        variant="success"
        title={title}
        description={`They're now ${label}.${already}`}
        onDismiss={onDismiss}
      />
    )
  }

  const hidden = state.failures.length - SHOWN_FAILURES
  return (
    <Alert
      variant="warning"
      title={title}
      description={
        <Box flexDirection="column" rowGap="xs">
          <Text variant="caption">
            {subscriptionsLabel(state.failures.length)} couldn&apos;t be
            updated.{already}
          </Text>
          <Box as="ul" flexDirection="column" rowGap="xs">
            {state.failures.slice(0, SHOWN_FAILURES).map(({ row, message }) => (
              <Box as="li" key={row.record_id} columnGap="xs">
                <Text variant="caption" truncate>
                  {row.customer_email || row.title}: {message}
                </Text>
              </Box>
            ))}
          </Box>
          {hidden > 0 ? (
            <Text variant="caption" color="muted">
              and {formatCount(hidden)} more
            </Text>
          ) : null}
        </Box>
      }
      actions={[
        { text: `Retry ${formatCount(state.failures.length)}`, onClick: retry },
      ]}
      onDismiss={onDismiss}
    />
  )
}
