'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useState } from 'react'
import { AssistedVariant } from './AssistedVariant'
import { ControlTowerVariant } from './ControlTowerVariant'
import { GuidedVariant } from './GuidedVariant'
import {
  applyPrototypeAction,
  initialPrototypeState,
  PrototypeAction,
  PrototypeState,
  PrototypeVariant,
} from './model'

const variants: {
  value: PrototypeVariant
  label: string
  short: string
}[] = [
  { value: 'guided', label: 'A · Guided', short: 'Best for small merchants' },
  { value: 'tower', label: 'B · Control tower', short: 'Best for operators' },
  { value: 'assisted', label: 'C · Assisted', short: 'Best for early access' },
]

const initialStates: Record<PrototypeVariant, PrototypeState> = {
  guided: initialPrototypeState,
  tower: initialPrototypeState,
  assisted: initialPrototypeState,
}

export default function MigrationPrototypesPage({
  organizationSlug,
}: {
  organizationSlug: string
}) {
  const [variant, setVariant] = useState<PrototypeVariant>('guided')
  const [states, setStates] =
    useState<Record<PrototypeVariant, PrototypeState>>(initialStates)
  const state = states[variant]
  const act = (action: PrototypeAction) => {
    setStates((current) => ({
      ...current,
      [variant]: applyPrototypeAction(current[variant], action),
    }))
  }

  return (
    <DashboardBody title="Migration experience prototypes">
      <Box flexDirection="column" rowGap="2xl">
        <Box
          alignItems={{ base: 'start', md: 'center' }}
          justifyContent="between"
          flexDirection={{ base: 'column', md: 'row' }}
          gap="l"
        >
          <Box flexDirection="column" rowGap="xs">
            <Text color="muted" wrap="pretty">
              Three complete mocked flows using the same Pepy-sized migration.
              No API calls or billing changes are made.
            </Text>
            <Link
              href={`/dashboard/${organizationSlug}/settings/migrations`}
              aria-label="Back to migrations"
            >
              <Text variant="caption">← Back to migrations</Text>
            </Link>
          </Box>
          <Button variant="ghost" size="sm" onClick={() => act('reset')}>
            Reset active variant
          </Button>
        </Box>

        <Alert
          variant="info"
          title="Interactive product prototype"
          description="Complete each flow from source connection through final billing ownership. Switching variants preserves each variant's progress."
        />

        <Box as="nav" aria-label="Prototype variants" gap="s" flexWrap="wrap">
          {variants.map((option) => (
            <Button
              key={option.value}
              variant={variant === option.value ? 'default' : 'secondary'}
              aria-pressed={variant === option.value}
              onClick={() => setVariant(option.value)}
            >
              <Box flexDirection="column" alignItems="start" rowGap="xs">
                <Text color="inherit" variant="label">
                  {option.label}
                </Text>
                <Text color="inherit" variant="caption">
                  {option.short}
                </Text>
              </Box>
            </Button>
          ))}
        </Box>

        {variant === 'guided' ? (
          <GuidedVariant state={state} act={act} />
        ) : null}
        {variant === 'tower' ? (
          <ControlTowerVariant state={state} act={act} />
        ) : null}
        {variant === 'assisted' ? (
          <AssistedVariant state={state} act={act} />
        ) : null}
      </Box>
    </DashboardBody>
  )
}
