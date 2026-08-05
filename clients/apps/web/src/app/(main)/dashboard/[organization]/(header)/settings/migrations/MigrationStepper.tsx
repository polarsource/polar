import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, Circle } from 'lucide-react'
import { currentPosition, MIGRATION_STEPS } from './steps'

type StepState = 'done' | 'current' | 'upcoming'

const MARKER_SIZE = 16

// One derived control: every segment carries the same 2px top track, and the
// filled length of that track is the only dimension encoding progress. Position
// and one consistent marker shape carry state; the accent is spent on the
// current step alone (its marker and its label).
export function MigrationStepper({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const position = currentPosition(migration)
  // A completed migration has every step behind it.
  const current =
    position.kind === 'completed' ? MIGRATION_STEPS.length : position.index

  return (
    <Box as="ol" alignItems="stretch" columnGap="s">
      {MIGRATION_STEPS.map((def, index) => {
        const state: StepState =
          index < current ? 'done' : index === current ? 'current' : 'upcoming'
        return <Segment key={def.key} label={def.short} state={state} />
      })}
    </Box>
  )
}

function Marker({ state }: { state: StepState }) {
  if (state === 'done') {
    return <Check size={MARKER_SIZE} strokeWidth={2.5} aria-hidden="true" />
  }
  return (
    <Circle
      size={MARKER_SIZE}
      fill={state === 'current' ? 'currentColor' : 'none'}
      aria-hidden="true"
    />
  )
}

const STATE_LABELS: Record<StepState, string> = {
  done: 'completed',
  current: 'current step',
  upcoming: 'not started',
}

function Segment({ label, state }: { label: string; state: StepState }) {
  const reached = state !== 'upcoming'
  const color =
    state === 'current'
      ? 'text-accent'
      : state === 'done'
        ? 'text-secondary'
        : 'text-tertiary'
  return (
    <Box
      as="li"
      // Colour and the marker carry the state visually; these carry it aloud.
      aria-current={state === 'current' ? 'step' : undefined}
      aria-label={`${label}, ${STATE_LABELS[state]}`}
      flex={1}
      minWidth={0}
      flexDirection="column"
      rowGap="s"
      paddingTop="s"
      borderTopWidth={2}
      borderStyle="solid"
      borderColor={reached ? 'border-primary' : 'border-secondary'}
    >
      <Box alignItems="center" columnGap="xs" color={color}>
        <Marker state={state} />
        <Text variant="caption" color="inherit" truncate>
          {label}
        </Text>
      </Box>
    </Box>
  )
}
