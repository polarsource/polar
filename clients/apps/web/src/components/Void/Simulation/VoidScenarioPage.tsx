'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { EmptyState } from '@/components/Shared/EmptyState'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { FlaskConical } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useContext, useMemo } from 'react'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { changedLevers } from './baseline'
import { project, replay } from './engine'
import { ScenarioCustomers } from './ScenarioCustomers'
import { ScenarioLevers } from './ScenarioLevers'
import { ScenarioProjection } from './ScenarioProjection'
import { ScenarioReplay } from './ScenarioReplay'
import { ScenarioModal } from './ScenarioModal'
import { useScenarios } from './store'
import { useSimulationCustomers } from './customers'

export const VoidScenarioPage = () => {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { organization } = useContext(OrganizationContext)
  const base = `/void/dashboard/${organization.slug}`
  const { scenarios, duplicate, update, remove, promote, isLoading, error } =
    useScenarios()
  const customers = useSimulationCustomers(organization.id, scenarios)
  const scenario = scenarios.find((candidate) => candidate.id === id)
  const editModal = useModal()
  const { toast } = useToast()

  const copyPullCommand = async () => {
    if (!scenario) return
    await navigator.clipboard.writeText(`void pull --scenario ${scenario.id}`)
    toast({
      title: 'Command copied',
      description:
        'Run it in your project to write this scenario as void.json, then deploy it to make it the real version.',
    })
  }

  const result = useMemo(
    () =>
      scenario && customers.data
        ? replay(scenario.levers, scenario.baseLevers, customers.data)
        : null,
    [scenario, customers.data],
  )
  const projection = useMemo(
    () =>
      scenario && customers.data
        ? project(scenario.levers, scenario.baseLevers, customers.data)
        : null,
    [scenario, customers.data],
  )

  if (isLoading || customers.isLoading || error || customers.error) {
    return (
      <DashboardBody title="Simulate">
        <Text>
          {error?.message ?? customers.error?.message ?? 'Loading simulation…'}
        </Text>
      </DashboardBody>
    )
  }

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

  const changes = changedLevers(scenario.levers, scenario.baseLevers)

  return (
    <DashboardBody
      title={scenario.name}
      contextView={<ScenarioLevers scenario={scenario} />}
      contextViewPlacement="left"
      contextViewTitle="Levers"
      contextViewClassName="md:max-w-[320px] xl:max-w-[360px]"
      header={
        <Box alignItems="center" columnGap="s">
          {scenario.promotedAs ? (
            <Text color="muted" variant="body">
              Promoted as {scenario.promotedAs}
            </Text>
          ) : (
            <Button
              onClick={() => promote(scenario.id)}
              disabled={changes.length === 0}
            >
              Promote to draft
            </Button>
          )}
          <Button variant="secondary" onClick={copyPullCommand}>
            Copy pull command
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none" asChild>
              <Button
                size="icon"
                variant="secondary"
                aria-label="More actions"
                className="text-[16px]"
              >
                <MoreVertOutlined fontSize="inherit" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="dark:bg-polar-800 bg-gray-50 shadow-lg"
            >
              <DropdownMenuItem
                onClick={() => window.setTimeout(editModal.show, 0)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const copy = await duplicate(scenario.id)
                  if (copy)
                    router.push(`${base}/definition/simulate/${copy.id}`)
                }}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  remove(scenario.id)
                  router.push(`${base}/definition/simulate`)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      }
    >
      <ScenarioModal
        key={scenario.updatedAt}
        isShown={editModal.isShown}
        hide={editModal.hide}
        title="Edit scenario"
        submitLabel="Save"
        initial={{ name: scenario.name, basedOn: scenario.basedOn }}
        onSubmit={(input) => update(scenario.id, { name: input.name })}
      />
      <Box flexDirection="column" rowGap="2xl">
        <Box
          flexDirection={{ base: 'column', md: 'row' }}
          alignItems={{ md: 'baseline' }}
          justifyContent="between"
          rowGap="s"
          columnGap="xl"
        >
          <Text color="muted" variant="body">
            <Link href={`${base}/definition/products`}>
              {scenario.basedOn.label}
            </Link>
            {' · '}
            {changes.length === 0
              ? 'Same as baseline'
              : `${changes.length} ${changes.length === 1 ? 'lever' : 'levers'} changed`}
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
