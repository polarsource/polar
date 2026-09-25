'use client'

import { PolarThemeProvider } from '@/app/providers'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useSearchParams } from 'next/navigation'
import { ComponentType } from 'react'
import {
  AssessmentPanelProps,
  useAssessmentLabels,
} from './AssessmentPanelParts'
import { DecisionsFirstPanel } from './DecisionsFirstPanel'
import { EntityCardsPanel } from './EntityCardsPanel'
import { PREVIEW_MIGRATION_ID, assessmentPreviewRow } from './previewFixture'
import { SummaryDisclosurePanel } from './SummaryDisclosurePanel'

const noop = () => {}

export function MigrationPanelPreview() {
  const params = useSearchParams()
  const labels = useAssessmentLabels()
  const selected = params.get('option')
  const options: {
    id: string
    title: string
    Panel: ComponentType<AssessmentPanelProps>
  }[] = [
    { id: '1', title: labels.optionDecisions, Panel: DecisionsFirstPanel },
    { id: '2', title: labels.optionCards, Panel: EntityCardsPanel },
    { id: '3', title: labels.optionSummary, Panel: SummaryDisclosurePanel },
  ]
  const visible = selected
    ? options.filter((option) => option.id === selected)
    : options

  return (
    <PolarThemeProvider>
      <Box
        flexDirection="column"
        rowGap="xl"
        padding="xl"
        minHeight="100vh"
        backgroundColor="background-secondary"
      >
        <Text variant="heading-s" as="h1">
          {labels.previewTitle}
        </Text>
        <Box
          flexWrap="wrap"
          alignItems="start"
          columnGap="xl"
          rowGap="xl"
          justifyContent={visible.length === 1 ? 'center' : 'start'}
        >
          {visible.map(({ id, title, Panel }) => (
            <Box
              key={id}
              flexDirection="column"
              rowGap="m"
              width={540}
              maxWidth="100%"
            >
              <Text variant="body" as="h2">
                {title}
              </Text>
              <Box
                width="100%"
                flexDirection="column"
                backgroundColor="background-primary"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
                borderRadius="m"
                overflow="hidden"
              >
                <Panel
                  row={assessmentPreviewRow}
                  migrationId={PREVIEW_MIGRATION_ID}
                  onClose={noop}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </PolarThemeProvider>
  )
}
