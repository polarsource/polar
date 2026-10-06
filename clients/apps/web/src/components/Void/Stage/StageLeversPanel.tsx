'use client'

import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LeversPanel } from '../Simulation/ScenarioLevers'
import type { StageLevers } from '../Simulation/stageLevers'
import { useSaveStage, type Stage } from './queries'

export const StageLeversPanel = ({
  organizationId,
  stage,
  stageLevers,
}: {
  organizationId: string
  stage: Stage
  stageLevers: StageLevers
}) => {
  const save = useSaveStage(organizationId)
  const { levers, stagedLevers, dirty, edit, discard, configuration } =
    stageLevers
  if (!levers || !stagedLevers) return null

  const saveToStage = () => {
    const next = configuration()
    if (next)
      save.mutate({ expected_revision: stage.revision, configuration: next })
  }

  return (
    <LeversPanel
      levers={levers}
      baseLevers={stagedLevers}
      onEdit={(mutate) => {
        save.reset()
        edit(mutate)
      }}
      actions={
        <Box flexDirection="column" rowGap="m">
          <Text color="muted" variant="caption">
            {dirty
              ? 'Unsaved changes. Save them to the stage to include them in a deployment.'
              : 'Adjust levers to explore the staged changes. Edits stay local until saved.'}
          </Text>
          {dirty ? (
            <Box columnGap="s">
              <Button size="sm" onClick={saveToStage} loading={save.isPending}>
                Save to stage
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={discard}
                disabled={save.isPending}
              >
                Discard
              </Button>
            </Box>
          ) : null}
          {save.error ? (
            <Alert
              variant="danger"
              title="Could not save to stage"
              description={save.error.message}
            />
          ) : null}
        </Box>
      }
    />
  )
}
