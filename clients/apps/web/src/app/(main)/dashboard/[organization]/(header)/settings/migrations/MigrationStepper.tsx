import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import { MIGRATION_STEPS, currentStepKey, stepPosition } from './steps'

type StepState = 'done' | 'current' | 'upcoming'

const STATE_LABELS: Record<StepState, string> = {
  done: 'completed',
  current: 'current',
  upcoming: 'upcoming',
}

// A slim, single-row progress indicator. It replaces the tall vertical timeline
// so the page leads with the current step's work, not five descriptions.
export function MigrationStepper({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const currentIndex = stepPosition(currentStepKey(migration))

  return (
    <Box
      as="ol"
      alignItems="center"
      width="100%"
      aria-label="Migration progress"
    >
      {MIGRATION_STEPS.map((def, index) => {
        const position = stepPosition(def.step)
        const state: StepState =
          position < currentIndex
            ? 'done'
            : position === currentIndex
              ? 'current'
              : 'upcoming'
        const last = index === MIGRATION_STEPS.length - 1

        return (
          <Box
            as="li"
            key={def.step}
            alignItems="center"
            columnGap="s"
            flex={last ? '0 0 auto' : 1}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <Box alignItems="center" columnGap="s" flexShrink={0}>
              <Node state={state} index={index} />
              <Text
                variant="caption"
                color={state === 'current' ? 'default' : 'muted'}
              >
                {def.short}
              </Text>
              <span className="sr-only">{STATE_LABELS[state]}</span>
            </Box>
            {!last && (
              <Box
                flex={1}
                minWidth={16}
                marginHorizontal="s"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

function Node({ state, index }: { state: StepState; index: number }) {
  if (state === 'done') {
    return (
      <Box
        width={22}
        height={22}
        flexShrink={0}
        borderRadius="full"
        alignItems="center"
        justifyContent="center"
        backgroundColor="background-secondary"
        color="text-secondary"
      >
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
      </Box>
    )
  }

  return (
    <Box
      width={22}
      height={22}
      flexShrink={0}
      borderRadius="full"
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderStyle="solid"
      borderColor={state === 'current' ? 'border-primary' : 'border-secondary'}
      backgroundColor={
        state === 'current' ? 'background-accent' : 'background-primary'
      }
    >
      <Text variant="caption" color={state === 'current' ? 'accent' : 'muted'}>
        {index + 1}
      </Text>
    </Box>
  )
}
