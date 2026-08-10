import { Text, TextColor } from '@polar-sh/orbit'
import { Check, Circle } from 'lucide-react'

// Shared by the top-level stepper and the card-transfer checklist so the two
// stay one visual language.

export type StepState = 'done' | 'current' | 'upcoming'

const MARKER_SIZE = 16

export const STATE_LABELS: Record<StepState, string> = {
  done: 'completed',
  current: 'current step',
  upcoming: 'not started',
}

// Named for `Text`, not `Box`: Box's `color` prop has no accent entry, so
// setting it there typechecks and then silently does nothing.
export const STATE_COLORS: Record<StepState, TextColor> = {
  done: 'muted',
  current: 'accent',
  upcoming: 'disabled',
}

// The icons draw with `currentColor`, so wrapping them in a coloured Text is
// what actually tints them.
export function StepMarker({ state }: { state: StepState }) {
  return (
    <Text as="span" color={STATE_COLORS[state]}>
      {state === 'done' ? (
        <Check size={MARKER_SIZE} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <Circle
          size={MARKER_SIZE}
          fill={state === 'current' ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      )}
    </Text>
  )
}
