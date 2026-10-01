'use client'

import { Alert, Spinner, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCount, subscriptionsLabel } from './bulkTaxCopy'
import { BulkTaxController } from './useBulkTaxUpdate'

const SHOWN_FAILURES = 5

function BulkTaxProgressBar({ done, total }: { done: number; total: number }) {
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
  onDismiss: () => void
}) {
  const { state, retry } = controller
  const target = state.target
  if (target === null) {
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

  if (state.phase === 'running') {
    return (
      <Box flexDirection="column" rowGap="s" width="100%">
        <Text variant="caption" tabularNums>
          Updating {formatCount(state.settled)} of {formatCount(state.total)}…
        </Text>
        <BulkTaxProgressBar done={state.settled} total={state.total} />
      </Box>
    )
  }

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
        title={`Every subscription is already ${target}`}
        description="Nothing needed to change."
        onDismiss={onDismiss}
      />
    )
  }

  const title = `Updated ${formatCount(state.updated)} of ${subscriptionsLabel(state.total)}`
  const already =
    state.alreadySet > 0
      ? ` ${subscriptionsLabel(state.alreadySet)} were already ${target}.`
      : ''

  if (state.failures.length === 0) {
    return (
      <Alert
        variant="success"
        title={title}
        description={`They're now ${target}.${already}`}
        onDismiss={onDismiss}
      />
    )
  }

  const hidden = state.failures.length - SHOWN_FAILURES
  return (
    <Box flexDirection="column" rowGap="s">
      <Alert
        variant="warning"
        title={title}
        description={`${subscriptionsLabel(state.failures.length)} couldn't be updated.${already}`}
        actions={[
          {
            text: `Retry ${formatCount(state.failures.length)}`,
            onClick: retry,
          },
        ]}
        onDismiss={onDismiss}
      />
      <Box as="ul" flexDirection="column" rowGap="xs" paddingHorizontal="l">
        {state.failures.slice(0, SHOWN_FAILURES).map(({ row, message }) => (
          <Box as="li" key={row.record_id}>
            <Text variant="caption" color="muted" truncate>
              {row.customer_email || row.title}: {message}
            </Text>
          </Box>
        ))}
        {hidden > 0 ? (
          <Box as="li">
            <Text variant="caption" color="muted">
              and {formatCount(hidden)} more
            </Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
