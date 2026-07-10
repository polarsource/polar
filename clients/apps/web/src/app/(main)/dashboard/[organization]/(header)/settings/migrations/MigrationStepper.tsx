import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import { currentVisibleIndex, MIGRATION_STEPS } from './steps'

type StepState = 'done' | 'current' | 'upcoming'

// Equal-width segments instead of hairline connectors: the row reads as one
// progress control, the current segment is tinted, done segments carry a check.
export function MigrationStepper({
  migration,
}: {
  migration: schemas['MerchantMigration']
}) {
  const current = currentVisibleIndex(migration)

  return (
    <Box as="ol" alignItems="stretch" columnGap="xs">
      {MIGRATION_STEPS.map((def, index) => {
        const state: StepState =
          index < current ? 'done' : index === current ? 'current' : 'upcoming'
        return (
          <Segment
            key={def.key}
            label={def.short}
            index={index}
            state={state}
          />
        )
      })}
    </Box>
  )
}

function Segment({
  label,
  index,
  state,
}: {
  label: string
  index: number
  state: StepState
}) {
  const current = state === 'current'
  return (
    <Box
      as="li"
      flex={1}
      minWidth={0}
      alignItems="center"
      columnGap="s"
      paddingVertical="s"
      paddingHorizontal="m"
      borderRadius="m"
      backgroundColor={
        current
          ? 'background-accent'
          : state === 'done'
            ? 'background-secondary'
            : 'background-primary'
      }
      borderWidth={state === 'upcoming' ? 1 : 0}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <Badge state={state} index={index} />
      <Text variant="caption" color={current ? 'accent' : 'muted'}>
        {label}
      </Text>
    </Box>
  )
}

function Badge({ state, index }: { state: StepState; index: number }) {
  if (state === 'done') {
    return (
      <Box color="text-secondary" alignItems="center" flexShrink={0}>
        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
      </Box>
    )
  }
  return (
    <Box
      width={18}
      height={18}
      flexShrink={0}
      borderRadius="full"
      alignItems="center"
      justifyContent="center"
      backgroundColor={
        state === 'current' ? 'background-primary' : 'background-secondary'
      }
    >
      <Text variant="caption" color={state === 'current' ? 'accent' : 'muted'}>
        {index + 1}
      </Text>
    </Box>
  )
}
