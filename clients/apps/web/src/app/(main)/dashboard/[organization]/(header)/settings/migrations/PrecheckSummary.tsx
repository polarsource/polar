'use client'

import { useModal } from '@/components/Modal/useModal'
import { schemas } from '@polar-sh/client'
import { Grid, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useState } from 'react'
import { PrecheckRecordsDrawer } from './PrecheckRecordsDrawer'
import { ENTITY_LABELS } from './reasons'

type Report = schemas['PrecheckReport']
type Summary = schemas['PrecheckEntitySummary']
type Entity = schemas['PrecheckEntity']

const ENTITY_ORDER: Entity[] = [
  'subscriptions',
  'customers',
  'products',
  'prices',
]

export function PrecheckSummary({
  migrationId,
  report,
}: {
  migrationId: string
  report: Report
}) {
  const byEntity = new Map<string, Summary>(
    report.entities.map((entity) => [entity.entity, entity]),
  )
  const drawer = useModal()
  const [selected, setSelected] = useState<Entity | null>(null)

  const open = (entity: Entity) => {
    setSelected(entity)
    drawer.show()
  }

  return (
    <Box flexDirection="column" rowGap="l">
      <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap="m">
        {ENTITY_ORDER.map((entity) => (
          <EntityCell
            key={entity}
            summary={byEntity.get(entity)}
            onOpen={() => open(entity)}
          />
        ))}
      </Grid>

      <Box
        paddingTop="s"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Text variant="caption" color="muted">
          Charges, refunds, disputes and tax history always stay on Stripe.
        </Text>
      </Box>

      <InlineModal
        isShown={drawer.isShown}
        hide={drawer.hide}
        className="md:w-[720px]"
        modalContent={
          selected ? (
            <PrecheckRecordsDrawer
              migrationId={migrationId}
              entity={selected}
              onClose={drawer.hide}
            />
          ) : null
        }
      />
    </Box>
  )
}

function EntityCell({
  summary,
  onOpen,
}: {
  summary?: Summary
  onOpen: () => void
}) {
  if (!summary) return null
  const clickable = summary.total > 0

  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      cursor={clickable ? 'pointer' : 'default'}
      onClick={clickable ? onOpen : undefined}
    >
      <Text variant="heading-m">{summary.importable}</Text>
      <Text variant="caption" color="muted">
        {ENTITY_LABELS[summary.entity] ?? summary.entity}
      </Text>
      {summary.skipped > 0 ? (
        <Text variant="caption" color="warning">
          {summary.skipped} stay on Stripe ›
        </Text>
      ) : summary.total > 0 ? (
        <Text variant="caption" color="success">
          All importing ›
        </Text>
      ) : (
        <Text variant="caption" color="muted">
          None found
        </Text>
      )}
    </Box>
  )
}
