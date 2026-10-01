'use client'

import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { BackgroundColorToken } from '@polar-sh/orbit/theme'
import { MappingTable } from '../MappingTable'
import { NextSteps } from '../NextSteps'
import {
  ProgressSegment,
  SwitchBatch,
  switchBatches,
  switchProgress,
} from '../viewModels'
import {
  LayoutProps,
  numberFormat,
  Panel,
  PhaseHeader,
  SectionTitle,
} from './shared'

const SEGMENT_COLORS: Record<ProgressSegment['key'], BackgroundColorToken> = {
  moved: 'background-inverse',
  ready: 'background-accent',
  left: 'background-warning',
  failed: 'background-danger',
  unprepared: 'background-card',
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

function ProgressBar({ segments }: { segments: ProgressSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0) || 1
  return (
    <Box flexDirection="column" rowGap="m">
      <Box
        height={14}
        borderRadius="full"
        overflow="hidden"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {segments.map((segment) =>
          segment.count > 0 ? (
            <Box
              key={segment.key}
              width={`${(segment.count / total) * 100}%`}
              backgroundColor={SEGMENT_COLORS[segment.key]}
              title={`${segment.label}: ${segment.count}`}
            />
          ) : null,
        )}
      </Box>
      <Box columnGap="xl" rowGap="s" flexWrap="wrap">
        {segments.map((segment) => (
          <Box key={segment.key} alignItems="center" columnGap="s">
            <Box
              width={10}
              height={10}
              borderRadius="full"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              backgroundColor={SEGMENT_COLORS[segment.key]}
            />
            <Text variant="caption" color="muted" tabularNums>
              {segment.label} {numberFormat.format(segment.count)}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function BatchTimeline({
  batches,
  pending,
  onOpenSwitch,
}: {
  batches: SwitchBatch[]
  pending: number
  onOpenSwitch: () => void
}) {
  return (
    <Box as="ol" flexDirection="column">
      {batches.map((batch, index) => (
        <Box
          as="li"
          key={batch.day}
          display="flex"
          columnGap="m"
          paddingVertical="s"
          borderTopWidth={index === 0 ? 0 : 1}
          borderStyle="solid"
          borderColor="border-secondary"
          justifyContent="between"
        >
          <Text variant="caption">
            Batch {index + 1} ·{' '}
            {dayFormat.format(new Date(`${batch.day}T12:00:00`))}
          </Text>
          <Text variant="caption" color="muted" tabularNums>
            {numberFormat.format(batch.count)} switched
          </Text>
        </Box>
      ))}
      {pending > 0 && (
        <Box
          as="li"
          display="flex"
          paddingTop="m"
          justifyContent="between"
          alignItems="center"
        >
          <Text variant="caption" color="muted">
            Next batch · {numberFormat.format(pending)} ready
          </Text>
          <Button size="sm" onClick={onOpenSwitch}>
            Continue switching
          </Button>
        </Box>
      )}
    </Box>
  )
}

// The same screen from the first batch to the last: the bar fills up, the
// batch log grows, and the ID map always covers what has already moved.
export function ProgressLayout(props: LayoutProps) {
  const { report, mapping, organizationSlug, onOpenSwitch, phase } = props
  const segments = switchProgress(report, mapping.subscriptions)
  const batches = switchBatches(mapping.subscriptions)
  const left = report.skipped + report.failed

  return (
    <Box flexDirection="column" rowGap="2xl">
      <PhaseHeader {...props} />
      <Grid
        templateColumns={{ base: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' }}
        gap="l"
      >
        <Panel>
          <SectionTitle title="Subscriptions" />
          <ProgressBar segments={segments} />
          {left > 0 && report.pending === 0 && (
            <Box columnGap="m" alignItems="center">
              <Text variant="caption" color="muted">
                {numberFormat.format(left)} stayed on Stripe with a reason.
              </Text>
              <Button size="sm" variant="secondary" onClick={onOpenSwitch}>
                Review
              </Button>
            </Box>
          )}
        </Panel>
        <Panel>
          <SectionTitle title="Batches" />
          {batches.length === 0 ? (
            <Text variant="caption" color="muted">
              Nothing switched yet.
            </Text>
          ) : (
            <BatchTimeline
              batches={batches}
              pending={report.pending}
              onOpenSwitch={onOpenSwitch}
            />
          )}
        </Panel>
      </Grid>
      <Box as="section" flexDirection="column" rowGap="m">
        <SectionTitle
          title={
            phase === 'complete' ? 'Stripe → Polar ID map' : 'ID map so far'
          }
          description={
            phase === 'complete'
              ? 'Every Stripe object this migration read, and the Polar object it became.'
              : 'Switched subscriptions already have their Polar ID. The rest fill in as you switch them.'
          }
        />
        <MappingTable mapping={mapping} organizationSlug={organizationSlug} />
      </Box>
      {phase === 'complete' && (
        <NextSteps organizationSlug={organizationSlug} compact />
      )}
    </Box>
  )
}
