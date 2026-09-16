'use client'

import { useVoidDeploys } from '@/components/Void/api'
import {
  applyChanges,
  describeChange,
} from '@/components/Void/Simulation/fromCompass'
import { useScenarios } from '@/components/Void/Simulation/store'
import { AssistantBlock } from '@/hooks/useCompassAssistant'
import AltRouteOutlined from '@mui/icons-material/AltRouteOutlined'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'

export const SimulationBlockView = ({
  block,
  organization,
}: {
  block: Extract<AssistantBlock, { type: 'simulation' }>
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const { create, updateLevers } = useScenarios()
  const deploys = useVoidDeploys(organization.id)
  const active = deploys.data?.find(
    (deploy) => deploy.status === 'active' && deploy.has_configuration,
  )

  const open = async () => {
    if (!active) return
    const scenario = await create({
      name: block.title,
      basedOn: { version: active.version_id },
    })
    updateLevers(scenario.id, (levers) => {
      applyChanges(levers, block.changes)
    })
    router.push(
      `/void/dashboard/${organization.slug}/definition/simulate/${scenario.id}`,
    )
  }

  return (
    <Box
      flexDirection="column"
      rowGap="l"
      padding="l"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card"
    >
      <Box alignItems="center" columnGap="s">
        <Box as="span" display="inline-flex" color="text-secondary">
          <AltRouteOutlined fontSize="inherit" />
        </Box>
        <Text variant="body">{block.title}</Text>
      </Box>
      <Box as="ul" flexDirection="column" rowGap="xs" display="flex">
        {block.changes.map((change, index) => (
          <Box as="li" key={index} display="flex">
            <Text color="muted" variant="caption">
              {describeChange(change)}
            </Text>
          </Box>
        ))}
      </Box>
      <Box alignItems="center" justifyContent="between" columnGap="m">
        <Text color="muted" variant="caption">
          {active
            ? 'Forks the active version and rebills the last 30 days of usage'
            : 'No active version with a stored configuration to fork'}
        </Text>
        <Button size="sm" onClick={open} disabled={!active}>
          Open in Simulate
        </Button>
      </Box>
    </Box>
  )
}
