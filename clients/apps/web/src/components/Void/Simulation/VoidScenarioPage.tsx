'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { FlaskConical } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { changedLevers } from './baseline'
import { project, replay } from './engine'
import { ScenarioCustomers } from './ScenarioCustomers'
import { ScenarioLevers } from './ScenarioLevers'
import { ScenarioProjection } from './ScenarioProjection'
import { ScenarioReplay } from './ScenarioReplay'
import { useScenarios } from './store'

const PROMOTED_VERSION = 'v15-draft'

export const VoidScenarioPage = () => {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const { scenarios, duplicate, update, remove } = useScenarios()
  const scenario = scenarios.find((candidate) => candidate.id === id)

  const result = useMemo(
    () => (scenario ? replay(scenario.levers) : null),
    [scenario],
  )
  const projection = useMemo(
    () => (scenario ? project(scenario.levers) : null),
    [scenario],
  )

  if (!scenario || !result || !projection) {
    return (
      <DashboardBody title="Simulate">
        <EmptyState
          icon={<FlaskConical />}
          title="Scenario not found"
          description="It may have been removed. Pick another one from the list."
        />
      </DashboardBody>
    )
  }

  const changes = changedLevers(scenario.levers)

  return (
    <DashboardBody
      title={scenario.name}
      contextView={<ScenarioLevers scenario={scenario} />}
      contextViewPlacement="left"
      contextViewTitle="Levers"
      contextViewClassName="md:max-w-[320px] xl:max-w-[360px]"
      titleActions={
        <Box alignItems="center" columnGap="s">
          <Button
            variant="ghost"
            onClick={() => {
              remove(scenario.id)
              router.push(`${base}/definition/simulate`)
            }}
          >
            Delete
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const copy = duplicate(scenario.id)
              if (copy) router.push(`${base}/definition/simulate/${copy.id}`)
            }}
          >
            Duplicate
          </Button>
          {scenario.promotedAs ? (
            <Status
              status={`Promoted to ${scenario.promotedAs}`}
              color="green"
            />
          ) : (
            <Button
              onClick={() =>
                update(scenario.id, { promotedAs: PROMOTED_VERSION })
              }
              disabled={changes.length === 0}
            >
              Promote to draft
            </Button>
          )}
        </Box>
      }
    >
      <Box flexDirection="column" rowGap="4xl">
        <Box
          flexDirection={{ base: 'column', md: 'row' }}
          alignItems={{ md: 'baseline' }}
          justifyContent="between"
          rowGap="s"
          columnGap="xl"
        >
          <Text color="muted">
            Branched from{' '}
            <Link href={`${base}/definition/products`}>
              {scenario.basedOn.definition} · {scenario.basedOn.version}
            </Link>
            .{' '}
            {changes.length === 0
              ? 'No levers changed yet, so it bills exactly like the baseline.'
              : `${changes.length} ${changes.length === 1 ? 'lever' : 'levers'} changed: ${changes.join(', ')}.`}
          </Text>
        </Box>

        <ScenarioReplay result={result} />
        <ScenarioCustomers result={result} base={base} />
        <ScenarioProjection
          points={projection}
          assumptions={scenario.levers.assumptions}
        />
      </Box>
    </DashboardBody>
  )
}
