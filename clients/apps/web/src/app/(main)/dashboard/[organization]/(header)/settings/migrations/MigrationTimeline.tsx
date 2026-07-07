import { schemas } from '@polar-sh/client'
import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check } from 'lucide-react'
import {
  MIGRATION_STEPS,
  OWNER_LABELS,
  currentStepKey,
  stepPosition,
} from './steps'

type StepState = 'done' | 'current' | 'upcoming'

export function MigrationTimeline({
  migration,
  onConnect,
}: {
  migration: schemas['MerchantMigration']
  onConnect: () => void
}) {
  const connected = migration.source_connected
  const currentIndex = stepPosition(currentStepKey(migration))

  return (
    <Box as="ol" flexDirection="column">
      {MIGRATION_STEPS.map((def, index) => {
        const position = stepPosition(def.step)
        const state: StepState =
          position < currentIndex
            ? 'done'
            : position === currentIndex
              ? 'current'
              : 'upcoming'
        const last = index === MIGRATION_STEPS.length - 1
        const ownerLabel = OWNER_LABELS[def.owner]
        const showConnect =
          state === 'current' && def.step === 'source_setup' && !connected

        return (
          <Box as="li" key={def.step} display="flex" columnGap="m">
            <Box flexDirection="column" alignItems="center" flexShrink={0}>
              <StepNode state={state} index={index} />
              {!last && (
                <Box
                  flex={1}
                  minHeight={20}
                  borderLeftWidth={2}
                  borderStyle="solid"
                  borderColor="border-primary"
                />
              )}
            </Box>

            <Box
              flexDirection="column"
              rowGap="xs"
              flex={1}
              paddingBottom={last ? 'none' : 'xl'}
            >
              <Box alignItems="center" columnGap="s">
                <Text
                  variant="body"
                  color={state === 'upcoming' ? 'muted' : 'default'}
                >
                  {def.title}
                </Text>
                {ownerLabel && (
                  <Status
                    status={ownerLabel}
                    color={def.owner === 'stripe' ? 'purple' : 'blue'}
                    size="small"
                  />
                )}
              </Box>
              <Text variant="caption" color="muted">
                {def.description}
              </Text>
              {showConnect && (
                <Box paddingTop="s">
                  <Button size="sm" onClick={onConnect}>
                    Connect Stripe
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function StepNode({ state, index }: { state: StepState; index: number }) {
  if (state === 'done') {
    return (
      <Box
        width={24}
        height={24}
        flexShrink={0}
        borderRadius="full"
        alignItems="center"
        justifyContent="center"
        backgroundColor="background-success"
        color="text-success"
      >
        <Check size={13} strokeWidth={2.5} aria-hidden="true" />
      </Box>
    )
  }

  return (
    <Box
      width={24}
      height={24}
      flexShrink={0}
      borderRadius="full"
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor={
        state === 'current' ? 'background-accent' : 'background-secondary'
      }
    >
      <Text variant="caption" color={state === 'current' ? 'accent' : 'muted'}>
        {index + 1}
      </Text>
    </Box>
  )
}
