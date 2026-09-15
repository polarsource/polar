'use client'

import {
  BASED_ON,
  BASELINE_LEVERS,
} from '@/components/Void/Simulation/baseline'
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
import { useMemo } from 'react'

export const SimulationBlockView = ({
  block,
  organization,
}: {
  block: Extract<AssistantBlock, { type: 'simulation' }>
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const { create, updateLevers } = useScenarios()

  const matched = useMemo(
    () =>
      block.changes.filter((change) => {
        const probe = structuredClone(BASELINE_LEVERS)
        return applyChanges(probe, [change]).length === 0
      }),
    [block.changes],
  )
  const unmatched = block.changes.length - matched.length

  const open = () => {
    const scenario = create({ name: block.title, basedOn: BASED_ON })
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
          {unmatched > 0
            ? `${unmatched} ${unmatched === 1 ? 'change does' : 'changes do'} not match a plan or meter in main · v14`
            : 'Rebills the last 30 days of real usage'}
        </Text>
        <Button size="sm" onClick={open} disabled={matched.length === 0}>
          Open in Simulate
        </Button>
      </Box>
    </Box>
  )
}
